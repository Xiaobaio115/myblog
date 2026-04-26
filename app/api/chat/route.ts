import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAILY_LIMIT = 2;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 6;
const MAX_OUTPUT_TOKENS = 300;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

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
    return "你可以问我文章、相册、3D 照片墙或者后台入口在哪里。";
  }

  const greetings = ["你好", "hi", "hello", "嗨", "在吗", "哈喽"];
  if (greetings.some((word) => message.includes(word))) {
    return "你好呀，我是 Luna。简单问题我可以直接回答，不会消耗 AI 次数。";
  }

  if (
    message.includes("文章") ||
    message.includes("博客") ||
    message.includes("post")
  ) {
    return "你可以点击导航里的文章，或者回到首页查看最新文章。文章内容由后台发布，并存储在 MongoDB 里。";
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
    return "3D 星空照片墙在相册页面可以进入，它会读取后台上传的照片并生成旋转照片墙。";
  }

  if (
    message.includes("后台") ||
    message.includes("管理") ||
    message.includes("上传") ||
    message.includes("发布")
  ) {
    return "后台入口是 /admin。登录后可以发布文章、上传照片、管理相册分类。";
  }

  if (message.includes("评论") || message.includes("留言")) {
    return "评论系统可以用 Twikoo 接在文章详情页，用来留言和互动。";
  }

  if (
    message.includes("你是谁") ||
    message.includes("luna") ||
    message.includes("虚拟人")
  ) {
    return "我是 Luna，这个博客右下角的小助手。简单问题我本地回答，复杂问题才调用 AI。";
  }

  return null;
}

function getDailyLimit() {
  const value = Number(process.env.AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
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

async function callAiModel(messages: ChatMessage[]) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (!apiKey) {
    throw new Error("服务器未配置 AI_API_KEY");
  }

  if (!baseUrl) {
    throw new Error("服务器未配置 AI_BASE_URL");
  }

  if (!model) {
    throw new Error("服务器未配置 AI_MODEL");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      stream: false,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("AI provider error:", data);

    throw new Error(
      data?.error?.message ||
        data?.message ||
        `模型接口请求失败：${response.status}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.output_text ||
    "";

  if (!reply) {
    console.error("Unexpected AI provider response:", data);
    throw new Error("模型接口返回格式无法解析");
  }

  return reply;
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
        usage: {
          counted: false,
          dailyLimit: getDailyLimit(),
        },
      });
    }

    const limit = await checkDailyLimit(request);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `今天 AI 聊天次数已经用完啦。前台每位访客每天最多 ${limit.dailyLimit} 次。你还可以问我文章、相册、3D 照片墙、后台入口这些简单问题。`,
        },
        { status: 429 }
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
        content:
          "你是个人博客右下角的虚拟助手，名字叫 Luna。回答要温柔、简洁，不要太长。你可以介绍博客、文章、相册、3D 照片墙和后台功能，但不要编造不存在的具体文章内容。",
      },
      ...safeMessages,
    ];

    const reply = await callAiModel(modelMessages);

    return NextResponse.json({
      reply,
      source: "ai",
      usage: {
        counted: true,
        dailyLimit: limit.dailyLimit,
        usedToday: limit.usedToday,
      },
    });
  } catch (error: any) {
    console.error("POST /api/chat error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "聊天服务暂时不可用，请稍后再试。",
      },
      { status: 500 }
    );
  }
}
