import { after, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { notifyOwnerOfChatMessage } from "@/lib/chat-notify";
import { getAiBehavior, getAiModePrompt, type AiMode } from "@/lib/ai-behavior-settings";
import { buildAiContentContext, type ChatAction } from "@/lib/ai-content-tools";
import { composeAiSystemPrompt } from "@/lib/ai-prompt";
import { getPublicAiModels, resolveAiModel } from "@/lib/ai-provider-settings";
import { readSseEvents } from "@/lib/ai-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "auto" } }
  >;
};

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

type SseEventName = "meta" | "status" | "reasoning" | "content" | "image" | "done" | "error";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function encodeSseEvent(event: SseEventName, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamLocalText(
  text: string,
  actions: ChatAction[] = [],
  mode?: AiMode,
  options: { sse?: boolean; modelId?: string } = {}
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (options.sse) {
        controller.enqueue(encoder.encode(encodeSseEvent("meta", { actions, mode, modelId: options.modelId || "" })));
        controller.enqueue(encoder.encode(encodeSseEvent("content", { delta: text })));
        controller.enqueue(encoder.encode(encodeSseEvent("done", {})));
      } else {
        controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  const headers = new Headers({
    "Content-Type": options.sse ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
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

function normalizeImages(value: unknown) {
  if (value === undefined || value === null) return { images: [] as string[], error: "" };
  if (!Array.isArray(value)) return { images: [] as string[], error: "图片参数格式不正确。" };
  if (value.length > MAX_IMAGES) {
    return { images: [] as string[], error: `最多只能上传 ${MAX_IMAGES} 张图片。` };
  }

  let totalBytes = 0;
  const images: string[] = [];
  for (const item of value) {
    const dataUrl = String(item || "");
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i);
    if (!match || !ALLOWED_IMAGE_TYPES.has(match[1].toLowerCase())) {
      return { images: [] as string[], error: "图片格式不正确，仅支持 JPG、PNG、WebP 和 GIF。" };
    }
    const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
    const bytes = (match[2].length * 3) / 4 - padding;
    if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
      return { images: [] as string[], error: "单张图片不能超过 4MB。" };
    }
    if (totalBytes + bytes > MAX_TOTAL_IMAGE_BYTES) {
      return { images: [] as string[], error: "图片总大小不能超过 8MB。" };
    }
    totalBytes += bytes;
    images.push(dataUrl);
  }
  return { images, error: "" };
}

function normalizeIncomingMessages(value: unknown): IncomingChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!isRecord(message)) return [];
    if (message.role !== "user" && message.role !== "assistant") return [];
    if (typeof message.content !== "string") return [];
    return [{ role: message.role, content: message.content }];
  });
}

function normalizeMessages(
  messages: IncomingChatMessage[],
  maxHistory: number,
  maxLength: number,
  images: string[] = []
) {
  const normalized = messages.slice(-maxHistory).map<ChatMessage>((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, maxLength),
  }));
  if (images.length > 0) {
    const lastUserIndex = normalized.findLastIndex((message) => message.role === "user");
    if (lastUserIndex >= 0) {
      const text = String(normalized[lastUserIndex].content || "");
      normalized[lastUserIndex] = {
        role: "user",
        content: [
          { type: "text", text },
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "auto" as const } })),
        ],
      };
    }
  }
  return normalized;
}

function normalizeProviderImage(value: unknown) {
  if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  if (!value || typeof value !== "object") return "";
  const candidate = value as { url?: unknown; image_url?: { url?: unknown } | string };
  const url = typeof candidate.image_url === "string"
    ? candidate.image_url
    : candidate.image_url?.url || candidate.url;
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : "";
}

function parseProviderDelta(value: unknown) {
  const json = value && typeof value === "object" ? value as {
    choices?: Array<{
      delta?: {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
        thinking?: unknown;
        images?: unknown;
      };
    }>;
  } : {};
  const delta = json.choices?.[0]?.delta || {};
  let content = "";
  const images: string[] = [];

  if (typeof delta.content === "string") {
    content = delta.content;
  } else if (Array.isArray(delta.content)) {
    for (const part of delta.content) {
      if (!part || typeof part !== "object") continue;
      const typedPart = part as { type?: unknown; text?: unknown; image_url?: unknown; url?: unknown };
      if (typedPart.type === "text" && typeof typedPart.text === "string") content += typedPart.text;
      const image = normalizeProviderImage(typedPart.image_url || typedPart.url);
      if (image) images.push(image);
    }
  }

  const reasoningValue = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
  const reasoning = typeof reasoningValue === "string" ? reasoningValue : "";
  if (Array.isArray(delta.images)) {
    for (const imageValue of delta.images) {
      const image = normalizeProviderImage(imageValue);
      if (image) images.push(image);
    }
  }
  return { content, reasoning, images: Array.from(new Set(images)).slice(0, 4) };
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "请求内容过大，图片请控制在 8MB 以内。" }, { status: 413 });
    }
    let parsedBody: unknown;
    try {
      parsedBody = await request.json();
    } catch {
      return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
    }
    if (!isRecord(parsedBody)) {
      return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
    }
    const body = parsedBody;
    const behavior = await getAiBehavior();
    const rawMessages = normalizeIncomingMessages(body.messages);
    const lastUserMessage = rawMessages.filter((message) => message.role === "user").at(-1);
    const userText = String(lastUserMessage?.content || "").trim();
    const wantsSse = body.responseFormat === "sse";
    const normalizedImages = normalizeImages(body.images);
    const images = normalizedImages.images;

    if (!userText) {
      return NextResponse.json({ error: "消息不能为空。" }, { status: 400 });
    }

    if (userText.length > behavior.maxMessageLength) {
      return NextResponse.json(
        { error: `消息太长了，请控制在 ${behavior.maxMessageLength} 字以内。` },
        { status: 400 }
      );
    }

    if (normalizedImages.error) {
      return NextResponse.json({ error: normalizedImages.error }, { status: 400 });
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
    const selectedModel = await resolveAiModel(typeof body.modelId === "string" ? body.modelId : undefined);
    if (images.length > 0 && !selectedModel?.supportsVision) {
      return NextResponse.json({ error: "当前模型未开启图片理解能力，请选择带“视觉”标记的模型。" }, { status: 400 });
    }
    const contentContext = behavior.promptControls.useSiteContext
      ? await buildAiContentContext(userText, behavior.capabilities, {
          currentPath: getPagePath(pageUrl),
        })
      : {
          context: "",
          fallbackText: "",
          directReply: "",
          actions: [] as ChatAction[],
          matched: false,
          sources: [] as string[],
        };
    const userAgent = request.headers.get("user-agent") || undefined;
    after(() =>
      notifyOwnerOfChatMessage({
        message: userText,
        pageUrl,
        userAgent,
      })
    );

    const textFallback = images.length === 0 ? contentContext.fallbackText : "";

    if (images.length === 0 && contentContext.directReply) {
      return streamLocalText(contentContext.directReply, contentContext.actions, activeMode, {
        sse: wantsSse,
        modelId: selectedModel?.id,
      });
    }

    const localReply = images.length === 0 && behavior.promptControls.useLocalFallbacks
      ? getLocalReply(userText)
      : "";
    if (!contentContext.matched && textFallback) {
      return streamLocalText(textFallback, contentContext.actions, activeMode, {
        sse: wantsSse,
        modelId: selectedModel?.id,
      });
    }

    const apiKey = selectedModel?.apiKey || "";
    const baseUrl = selectedModel?.baseUrl || "";
    const model = selectedModel?.model || "";

    if (!apiKey || !baseUrl || !model) {
      if (textFallback) {
        return streamLocalText(textFallback, contentContext.actions, activeMode, { sse: wantsSse });
      }
      if (localReply) {
        return streamLocalText(localReply, contentContext.actions, activeMode, { sse: wantsSse });
      }
      return NextResponse.json({ error: "服务端 AI 配置不完整。" }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const systemPrompt = composeAiSystemPrompt({
      systemPrompt: behavior.systemPrompt,
      knowledgeText: behavior.knowledgeText,
      modePrompt: getAiModePrompt(activeMode, behavior.modePrompts),
      controls: behavior.promptControls,
    });

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
            ...(systemPrompt
              ? [{ role: "system" as const, content: systemPrompt }]
              : []),
            ...(contentContext.context
              ? [{ role: "system" as const, content: contentContext.context }]
              : []),
            ...normalizeMessages(rawMessages, behavior.maxHistoryMessages, behavior.maxMessageLength, images),
          ],
          max_tokens: behavior.maxOutputTokens,
          temperature: behavior.temperature,
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (textFallback) {
        console.error("AI provider request failed; using indexed content fallback:", error);
        return streamLocalText(textFallback, contentContext.actions, activeMode, {
          sse: wantsSse,
          modelId: selectedModel?.id,
        });
      }
      if (localReply) {
        console.error("AI provider request failed; using local reply fallback:", error);
        return streamLocalText(localReply, contentContext.actions, activeMode, {
          sse: wantsSse,
          modelId: selectedModel?.id,
        });
      }
      throw error;
    }

    if (!aiResponse.ok || !aiResponse.body) {
      clearTimeout(timeoutId);
      const errorText = await aiResponse.text().catch(() => "");
      console.error("AI provider error:", { status: aiResponse.status, url, model, errorText });
      if (textFallback) {
        return streamLocalText(textFallback, contentContext.actions, activeMode, {
          sse: wantsSse,
          modelId: selectedModel?.id,
        });
      }
      if (localReply) {
        return streamLocalText(localReply, contentContext.actions, activeMode, {
          sse: wantsSse,
          modelId: selectedModel?.id,
        });
      }
      return NextResponse.json({ error: "AI 服务暂时不可用。" }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = aiResponse.body.getReader();

    const stream = new ReadableStream({
      async start(streamController) {
        let buffer = "";
        const sendEvent = (event: SseEventName, data: unknown) => {
          streamController.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };
        const processProviderData = (data: unknown) => {
          const delta = parseProviderDelta(data);
          if (delta.reasoning && wantsSse) sendEvent("reasoning", { delta: delta.reasoning });
          if (delta.content) {
            if (wantsSse) sendEvent("content", { delta: delta.content });
            else streamController.enqueue(encoder.encode(delta.content));
          }
          for (const imageUrl of delta.images) {
            if (wantsSse) sendEvent("image", { url: imageUrl });
            else streamController.enqueue(encoder.encode(`\n\n![AI 生成图片](${imageUrl})\n\n`));
          }
        };

        if (wantsSse) {
          sendEvent("meta", {
            actions: contentContext.actions,
            mode: activeMode,
            modelId: selectedModel?.id || "",
          });
          sendEvent("status", {
            phase: selectedModel?.supportsReasoning ? "thinking" : "generating",
            message: selectedModel?.supportsReasoning ? "模型正在思考" : "模型正在生成回答",
          });
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parsed = readSseEvents(buffer);
            buffer = parsed.remainder;
            parsed.events.forEach((event) => processProviderData(event.data));
          }

          buffer += decoder.decode();
          readSseEvents(buffer, { flush: true }).events.forEach((event) => processProviderData(event.data));

          if (wantsSse) sendEvent("done", {});
          streamController.close();
        } catch (error) {
          console.error("chat stream error:", error);
          if (wantsSse) sendEvent("error", { message: "回复中断了，请稍后再试。" });
          else streamController.enqueue(encoder.encode("\n\n回复中断了，请稍后再试。"));
          streamController.close();
        } finally {
          clearTimeout(timeoutId);
        }
      },
    });

    const headers = new Headers({
      "Content-Type": wantsSse ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
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
  const [behavior, modelPool] = await Promise.all([getAiBehavior(), getPublicAiModels()]);
  return NextResponse.json(
    {
      defaultMode: behavior.mode,
      enabledModes: behavior.enabledModes,
      modes: behavior.enabledModes.map((value) => ({
        value,
        label: behavior.modeLabels[value],
      })),
      capabilities: behavior.capabilities,
      maxMessageLength: behavior.maxMessageLength,
      conversationHistoryEnabled: behavior.conversationHistoryEnabled,
      defaultModelId: modelPool.defaultModelId,
      models: modelPool.models,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
