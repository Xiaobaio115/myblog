import { NextResponse } from "next/server";
import { getEffectiveChatNotificationSettings } from "@/lib/chat-notification-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "服务端尚未配置 ADMIN_PASSWORD。" }, { status: 401 });
  }
  if (request.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "密码错误。" }, { status: 401 });
  }

  const {
    aiApiKey: apiKey,
    aiBaseUrl: baseUrl,
    aiModel: model,
  } = await getEffectiveChatNotificationSettings();

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "缺少 AI_API_KEY" },
      { status: 500 }
    );
  }

  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "缺少 AI_BASE_URL" },
      { status: 500 }
    );
  }

  if (!model) {
    return NextResponse.json(
      { ok: false, error: "缺少 AI_MODEL" },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 60,
        temperature: 0.3,
        stream: false,
        messages: [
          {
            role: "user",
            content: "只回复两个字：你好",
          },
        ],
      }),
    });

    const text = await res.text();
    const ms = Date.now() - startedAt;

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      ms,
      model,
      baseUrl,
      raw: text.slice(0, 2000),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : null;
    return NextResponse.json(
      {
        ok: false,
        errorName: err?.name,
        errorMessage:
          err?.name === "AbortError"
            ? "AI 接口 60 秒超时"
            : err?.message || "未知错误",
        model,
        baseUrl,
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
