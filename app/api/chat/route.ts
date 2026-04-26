import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 500;

function getDailyLimit() {
  const value = Number(process.env.AI_DAILY_LIMIT || 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function getLocalReply(text: string) {
  const message = text.trim().toLowerCase();

  if (
    message.includes("你好") ||
    message.includes("hi") ||
    message.includes("hello") ||
    message.includes("嗨")
  ) {
    return "你好呀，我是 Luna。简单问题我可以直接回答，不消耗 AI 次数。";
  }

  if (
    message.includes("服务") ||
    message.includes("功能") ||
    message.includes("能做什么") ||
    message.includes("你会什么")
  ) {
    return "我可以介绍这个博客的文章、相册、3D 星空照片墙和后台入口。复杂问题才会调用 AI。";
  }

  if (
    message.includes("相册") ||
    message.includes("照片") ||
    message.includes("图片")
  ) {
    return "你可以进入相册页面浏览图片，也可以打开 3D 星空照片墙。照片会按分类展示。";
  }

  if (
    message.includes("后台") ||
    message.includes("上传") ||
    message.includes("发布")
  ) {
    return "后台入口是 /admin，登录后可以发布文章、上传照片和管理相册分类。";
  }

  return null;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function checkLimit(request: Request) {
  const dailyLimit = getDailyLimit();

  const db = await getDb();
  const ip = getClientIp(request);
  const date = getTodayKey();
  const key = `${ip}:${date}`;

  const result = await db.collection("chat_usage").findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        key,
        ip,
        date,
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

  const usedToday = result?.count || 1;

  return {
    usedToday,
    dailyLimit,
    allowed: usedToday <= dailyLimit,
  };
}

async function callAi(message: string) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (!apiKey) throw new Error("服务器未配置 AI_API_KEY");
  if (!baseUrl) throw new Error("服务器未配置 AI_BASE_URL");
  if (!model) throw new Error("服务器未配置 AI_MODEL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.7,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "你是个人博客右下角的虚拟助手，名字叫 Luna。回答要温柔、简洁，不要太长。",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("AI provider error:", data);

      throw new Error(
        data?.error?.message ||
          data?.message ||
          `模型接口请求失败：${res.status}`
      );
    }

    return (
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "我刚刚没有收到有效回复。"
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("模型接口响应超时，请稍后再试。");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const lastUserMessage = messages
      .filter((item: any) => item.role === "user")
      .at(-1);

    const userText = String(lastUserMessage?.content || "").trim();

    if (!userText) {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }

    if (userText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `消息太长啦，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。` },
        { status: 400 }
      );
    }

    const localReply = getLocalReply(userText);

    if (localReply) {
      return NextResponse.json({
        reply: localReply,
        source: "local",
      });
    }

    const limit = await checkLimit(request);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `今天 AI 聊天次数已经用完啦，每位访客每天最多 ${limit.dailyLimit} 次。`,
        },
        { status: 429 }
      );
    }

    const reply = await callAi(userText);

    return NextResponse.json({
      reply,
      source: "ai",
      usedToday: limit.usedToday,
      dailyLimit: limit.dailyLimit,
    });
  } catch (error: any) {
    console.error("POST /api/chat error:", error);

    return NextResponse.json(
      {
        error: error?.message || "聊天服务暂时不可用",
      },
      { status: 500 }
    );
  }
}
