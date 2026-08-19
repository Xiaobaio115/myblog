import { after, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { notifyOwnerOfChatMessage } from "@/lib/chat-notify";
import { getEffectiveChatNotificationSettings } from "@/lib/chat-notification-settings";
import { getAiBehavior, getAiModePrompt, type AiMode } from "@/lib/ai-behavior-settings";
import { buildAiContentContext, type ChatAction } from "@/lib/ai-content-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

function getDailyLimit(configuredLimit: number) {
  const envValue = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(envValue) && envValue > 0 ? envValue : configuredLimit;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalReply(text: string) {
  const message = text.trim().toLowerCase();

  if (!message) return "你可以问我文章、相册、3D 照片墙，或者后台入口在哪里。";

  if (["你好", "hi", "hello", "在吗"].some((word) => message.includes(word))) {
    return "你好呀，我是甘蔗。可以陪你逛逛这个博客，也可以帮你快速找到文章、相册和旅行地图。";
  }

  if (message.includes("相册") || message.includes("照片") || message.includes("photo")) {
    return "相册页可以浏览照片，也可以进入 3D 星空相册，用更沉浸的方式看照片墙。";
  }

  if (message.includes("3d") || message.includes("星空")) {
    return "3D 星空相册在相册页面可以进入，它会把上传的照片放进一个可旋转的星空照片墙。";
  }

  if (message.includes("后台") || message.includes("管理") || message.includes("上传")) {
    return "后台入口是 /admin。登录后可以管理文章、照片、留言和站点内容。";
  }

  if (message.includes("旅行") || message.includes("地图")) {
    return "旅行地图在“我的世界”里，可以用 3D 中国地图查看走过的城市和照片记录。";
  }

  return "";
}

function addChatMetadata(headers: Headers, actions: ChatAction[], mode?: AiMode) {
  if (actions.length > 0) {
    headers.set("X-Chat-Actions", encodeURIComponent(JSON.stringify(actions)));
  }
  if (mode) headers.set("X-Chat-Mode", mode);
}

function streamLocalText(text: string, actions: ChatAction[] = [], mode?: AiMode) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  addChatMetadata(headers, actions, mode);
  return new Response(stream, { headers });
}

function getPagePath(pageUrl: string | undefined) {
  if (!pageUrl) return "";
  try {
    const url = new URL(pageUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.pathname : "";
  } catch {
    return "";
  }
}

async function checkDailyLimit(request: Request, configuredLimit: number) {
  const dailyLimit = getDailyLimit(configuredLimit);
  const ip = getClientIp(request);
  const key = `${getTodayKey()}::${ip}`;

  try {
    const db = await getDb();
    const result = await db.collection("ai_usage").findOneAndUpdate(
      { key },
      {
        $setOnInsert: { key, ip, day: getTodayKey(), createdAt: new Date() },
        $inc: { count: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );

    const count = Number(result?.count ?? 0);
    return { allowed: count <= dailyLimit, dailyLimit };
  } catch {
    return { allowed: true, dailyLimit };
  }
}

function normalizeMessages(messages: IncomingChatMessage[], maxHistory: number, maxLength: number) {
  return messages.slice(-maxHistory).map<ChatMessage>((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, maxLength),
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const behavior = await getAiBehavior();
    const rawMessages: IncomingChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage = rawMessages.filter((message) => message.role === "user").at(-1);
    const userText = String(lastUserMessage?.content || "").trim();

    if (!userText) {
      return NextResponse.json({ error: "消息不能为空。" }, { status: 400 });
    }

    if (userText.length > behavior.maxMessageLength) {
      return NextResponse.json(
        { error: `消息太长了，请控制在 ${behavior.maxMessageLength} 字以内。` },
        { status: 400 }
      );
    }

    const limit = await checkDailyLimit(request, behavior.dailyLimit);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `今天聊天次数已经用完了。每位访客每天最多 ${limit.dailyLimit} 次。` },
        { status: 429 }
      );
    }

    const pageUrl =
      typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : undefined;
    const requestedMode = typeof body.mode === "string" ? body.mode : "";
    const activeMode = behavior.enabledModes.includes(requestedMode as AiMode)
      ? requestedMode as AiMode
      : behavior.mode;
    const contentContext = await buildAiContentContext(userText, behavior.capabilities, {
      currentPath: getPagePath(pageUrl),
    });
    const userAgent = request.headers.get("user-agent") || undefined;
    after(() =>
      notifyOwnerOfChatMessage({
        message: userText,
        pageUrl,
        userAgent,
      })
    );

    if (contentContext.directReply) {
      return streamLocalText(contentContext.directReply, contentContext.actions, activeMode);
    }

    const localReply = getLocalReply(userText);
    if (!contentContext.matched && contentContext.fallbackText) {
      return streamLocalText(contentContext.fallbackText, contentContext.actions, activeMode);
    }

    const {
      aiApiKey: apiKey,
      aiBaseUrl: baseUrl,
      aiModel: model,
    } = await getEffectiveChatNotificationSettings();

    if (!apiKey || !baseUrl || !model) {
      if (contentContext.fallbackText) {
        return streamLocalText(contentContext.fallbackText, contentContext.actions, activeMode);
      }
      if (localReply) {
        return streamLocalText(localReply, contentContext.actions, activeMode);
      }
      return NextResponse.json({ error: "服务端 AI 配置不完整。" }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // 规范化 baseUrl：如果只是域名（如 https://new.xkool.cfd），自动加 /v1
    let normalizedUrl = baseUrl.replace(/\/$/, "");
    if (!normalizedUrl.includes('/v1') && !normalizedUrl.includes('/chat/completions')) {
      normalizedUrl = `${normalizedUrl}/v1`;
    }

    // 如果已包含完整路径，直接使用；否则拼接 /chat/completions
    const url = normalizedUrl.includes('/chat/completions')
      ? normalizedUrl
      : `${normalizedUrl}/chat/completions`;

    console.log("[chat] calling AI:", { originalBaseUrl: baseUrl, url, model, keyLen: apiKey?.length || 0 });

    let aiResponse: Response;
    try {
      aiResponse = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: [
                behavior.systemPrompt,
                behavior.knowledgeText ? `站点知识补充：\n${behavior.knowledgeText}` : "",
                getAiModePrompt(activeMode, behavior.modePrompts),
                "输出可以使用 Markdown；代码请使用带语言标记的围栏代码块；表情符号可按语气自然使用。不要输出原始 HTML。",
              ].filter(Boolean).join("\n\n"),
            },
            ...(contentContext.context
              ? [{ role: "system" as const, content: contentContext.context }]
              : []),
            ...normalizeMessages(rawMessages, behavior.maxHistoryMessages, behavior.maxMessageLength),
          ],
          max_tokens: behavior.maxOutputTokens,
          temperature: behavior.temperature,
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (contentContext.fallbackText) {
        console.error("AI provider request failed; using indexed content fallback:", error);
        return streamLocalText(contentContext.fallbackText, contentContext.actions, activeMode);
      }
      if (localReply) {
        console.error("AI provider request failed; using local reply fallback:", error);
        return streamLocalText(localReply, contentContext.actions, activeMode);
      }
      throw error;
    }

    if (!aiResponse.ok || !aiResponse.body) {
      clearTimeout(timeoutId);
      const errorText = await aiResponse.text().catch(() => "");
      console.error("AI provider error:", { status: aiResponse.status, url, model, errorText });
      if (contentContext.fallbackText) {
        return streamLocalText(contentContext.fallbackText, contentContext.actions, activeMode);
      }
      if (localReply) {
        return streamLocalText(localReply, contentContext.actions, activeMode);
      }
      return NextResponse.json({ error: "AI 服务暂时不可用。" }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = aiResponse.body.getReader();

    const stream = new ReadableStream({
      async start(streamController) {
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              const line = part
                .split("\n")
                .find((item) => item.startsWith("data:"))
                ?.replace(/^data:\s*/, "")
                .trim();

              if (!line || line === "[DONE]") continue;

              try {
                const json = JSON.parse(line) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) streamController.enqueue(encoder.encode(delta));
              } catch {
                // Ignore incomplete provider chunks.
              }
            }
          }

          streamController.close();
        } catch (error) {
          console.error("chat stream error:", error);
          streamController.enqueue(encoder.encode("\n\n回复中断了，请稍后再试。"));
          streamController.close();
        } finally {
          clearTimeout(timeoutId);
        }
      },
    });

    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    });
    addChatMetadata(headers, contentContext.actions, activeMode);
    return new Response(stream, { headers });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : null;
    console.error("POST /api/chat error:", error);

    const message =
      err?.name === "AbortError"
        ? "模型接口响应超时，请稍后再试。"
        : err?.message || "聊天服务暂时不可用。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const behavior = await getAiBehavior();
  return NextResponse.json(
    {
      defaultMode: behavior.mode,
      enabledModes: behavior.enabledModes,
      modes: behavior.enabledModes.map((value) => ({
        value,
        label: behavior.modeLabels[value],
      })),
      capabilities: behavior.capabilities,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
