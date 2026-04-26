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

const LUNA_SYSTEM_PROMPT = `
你是这个个人博客的右下角虚拟助手，名字叫 甘蔗。

你的身份：
- 你是一个温柔、轻松、可爱的博客小助手。
- 你不是客服，不要说得太官方。
- 你的语气像朋友一样，简洁、自然、带一点温柔感。
- 回答不要太长，除非用户明确要求详细说明。

你能做的事：
- 引导访客浏览首页、文章、相册、3D 星空照片墙。
- 解释这个博客的功能。
- 给用户一些写文章、整理相册、博客优化的小建议。
- 陪用户进行简单聊天。
- 如果用户问技术问题，可以用简单易懂的方式解释。

你不能做的事：
- 不要编造不存在的文章、照片、分类或用户资料。
- 如果你不知道博客里具体有哪些文章，就说我现在不能直接看到完整文章列表，你可以去首页或文章页看看。
- 不要声称自己能访问后台或修改数据。
- 不要暴露 API、密钥、数据库、服务器配置等敏感信息。

回答风格：
- 中文为主。
- 简洁。
- 温柔。
- 不要大段堆砌。
- 可以适当使用 emoji，但不要回答太多没有用的信息。
`;

function getDailyLimit() {
  const value = Number(process.env.AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return realIp || "unknown";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalReply(text: string) {
  const message = text.trim().toLowerCase();

  if (!message) {
    return "你可以问我文章、相册、3D 照片墙，或者后台入口在哪里。";
  }

  if (
    ["你好", "hi", "hello", "嗨", "在吗", "哈喽"].some((word) =>
      message.includes(word)
    )
  ) {
    return "你好呀，我是 Luna。可以陪你聊聊，也可以带你逛逛这个小宇宙博客。";
  }

  if (
    message.includes("相册") ||
    message.includes("照片") ||
    message.includes("图片") ||
    message.includes("photo")
  ) {
    return "你可以进入相册页面浏览图片。相册支持分类，后台上传照片后会自动显示。";
  }

  if (
    message.includes("3d") ||
    message.includes("星空") ||
    message.includes("照片墙")
  ) {
    return "3D 星空照片墙在相册页面可以进入，它会读取后台上传的照片，并生成旋转照片墙。";
  }

  if (
    message.includes("后台") ||
    message.includes("管理") ||
    message.includes("上传") ||
    message.includes("发布")
  ) {
    return "后台入口是 /admin。登录后可以发布文章、上传照片、管理相册分类。";
  }

  if (
    message.includes("服务") ||
    message.includes("功能") ||
    message.includes("能做什么") ||
    message.includes("你会什么") ||
    message.includes("有什么用")
  ) {
    return "我可以介绍这个博客的文章、相册、3D 星空照片墙和后台入口。简单问题我会直接回答，复杂问题才会调用 AI。";
  }

  if (
    message.includes("你是谁") ||
    message.includes("luna") ||
    message.includes("虚拟人")
  ) {
    return "我是 Luna，这个博客右下角的小助手。简单问题我可以直接回答，复杂问题会调用 AI。";
  }

  if (
    message.includes("联系") ||
    message.includes("联系方式") ||
    message.includes("邮箱") ||
    message.includes("email") ||
    message.includes("微信") ||
    message.includes("站长")
  ) {
    return [
      "可以这样联系我：",
      "",
      "📮 邮箱：3559078927@qq.com",
      "🌐 GitHub：暂无",
      "💬 其他方式：可以在文章评论区留言，我看到后会回复。",
    ].join("\n");
  }

  return null;
}

async function checkDailyLimit(request: Request) {
  const dailyLimit = getDailyLimit();
  const ip = getClientIp(request);
  const today = getTodayKey();
  const usageKey = `${ip}:${today}`;

  const db = await getDb();
  const usageCollection = db.collection("chat_usage");

  const usage = await usageCollection.findOneAndUpdate(
    { key: usageKey },
    {
      $setOnInsert: {
        key: usageKey,
        ip,
        date: today,
        createdAt: new Date(),
      },
      $inc: {
        count: 1,
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  const usedToday = usage?.count || 1;

  return {
    allowed: usedToday <= dailyLimit,
    usedToday,
    dailyLimit,
  };
}

function streamLocalText(text: string) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    }
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "chat api is working",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    const lastUserMessage = rawMessages
      .filter((message: any) => message.role === "user")
      .at(-1);

    const userText = String(lastUserMessage?.content || "").trim();

    if (!userText) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    if (userText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `消息太长啦，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。` },
        { status: 400 }
      );
    }

    const localReply = getLocalReply(userText);

    if (localReply) {
      return streamLocalText(localReply);
    }

    const limit = await checkDailyLimit(request);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `今天 AI 聊天次数已经用完啦。每位访客每天最多 ${limit.dailyLimit} 次。你还可以问我文章、相册、3D 照片墙、后台入口这些简单问题。`,
        },
        { status: 429 }
      );
    }

    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;

    if (!apiKey) {
      return NextResponse.json(
        { error: "服务器未配置 AI_API_KEY" },
        { status: 500 }
      );
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: "服务器未配置 AI_BASE_URL" },
        { status: 500 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "服务器未配置 AI_MODEL" },
        { status: 500 }
      );
    }

    const safeMessages: ChatMessage[] = rawMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message: any) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH),
      }));

    const modelMessages: ChatMessage[] = [
      {
        role: "system",
        content: LUNA_SYSTEM_PROMPT,
      },
      ...safeMessages,
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const url = `${normalizedBaseUrl}/chat/completions`;

    const aiResponse = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: modelMessages,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        stream: true,
      }),
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!aiResponse.ok || !aiResponse.body) {
      const errorText = await aiResponse.text().catch(() => "");
      console.error("AI provider error:", errorText);

      return NextResponse.json(
        { error: `模型接口请求失败：${aiResponse.status}` },
        { status: 500 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();

              if (!trimmed.startsWith("data:")) continue;

              const data = trimmed.replace(/^data:\s*/, "");

              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data);

                const delta =
                  json?.choices?.[0]?.delta?.content ||
                  json?.choices?.[0]?.message?.content ||
                  "";

                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // Ignore incomplete SSE chunks.
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error("chat stream error:", error);
          controller.enqueue(encoder.encode("\n\n回复中断了，请稍后再试。"));
          controller.close();
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
  } catch (error: any) {
    console.error("POST /api/chat error:", error);

    const message =
      error?.name === "AbortError"
        ? "模型接口响应超时，请稍后再试。"
        : error?.message || "聊天服务暂时不可用。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
