import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAILY_LIMIT = 10;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 6;
const MAX_OUTPUT_TOKENS = 300;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

const ASSISTANT_SYSTEM_PROMPT = `
你是这个个人博客右下角的虚拟助手，名字叫甘蔗。
你的语气像朋友一样自然、简洁、温和，不要过度正式。
你可以介绍博客里的首页、文章、相册、3D 星空相册、我的世界、旅行地图和后台入口。
你不能声称自己能访问后台、修改数据、看到秘密配置或编造不存在的文章和照片。
回答以中文为主，尽量短一些；只有用户明确要求详细说明时再展开。
`;

function getDailyLimit() {
  const value = Number(process.env.AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
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

function streamLocalText(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

async function checkDailyLimit(request: Request) {
  const dailyLimit = getDailyLimit();
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

function normalizeMessages(messages: IncomingChatMessage[]) {
  return messages.slice(-MAX_HISTORY_MESSAGES).map<ChatMessage>((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH),
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages: IncomingChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage = rawMessages.filter((message) => message.role === "user").at(-1);
    const userText = String(lastUserMessage?.content || "").trim();

    if (!userText) {
      return NextResponse.json({ error: "消息不能为空。" }, { status: 400 });
    }

    if (userText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `消息太长了，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。` },
        { status: 400 }
      );
    }

    const localReply = getLocalReply(userText);
    if (localReply) return streamLocalText(localReply);

    const limit = await checkDailyLimit(request);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `今天 AI 聊天次数已经用完了。每位访客每天最多 ${limit.dailyLimit} 次。` },
        { status: 429 }
      );
    }

    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;

    if (!apiKey || !baseUrl || !model) {
      return NextResponse.json({ error: "服务端 AI 配置不完整。" }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const aiResponse = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: ASSISTANT_SYSTEM_PROMPT }, ...normalizeMessages(rawMessages)],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        stream: true,
      }),
    }).finally(() => clearTimeout(timeoutId));

    if (!aiResponse.ok || !aiResponse.body) {
      const errorText = await aiResponse.text().catch(() => "");
      console.error("AI provider error:", errorText);
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
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
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
