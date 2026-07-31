import { NextResponse } from "next/server";
import {
  getChatNotificationSettingsSummary,
  updateChatNotificationSettings,
} from "@/lib/chat-notification-settings";
import { sendChatNotificationTest } from "@/lib/chat-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return "服务端尚未配置 ADMIN_PASSWORD。";
  }
  if (request.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return "密码错误。";
  }
  return null;
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    return NextResponse.json(await getChatNotificationSettingsSummary());
  } catch (error) {
    console.error("GET /api/chat-notification-settings error:", error);
    return NextResponse.json({ error: "读取聊天通知配置失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    await updateChatNotificationSettings(await request.json());
    return NextResponse.json({
      success: true,
      settings: await getChatNotificationSettingsSummary(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存聊天通知配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    await sendChatNotificationTest();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试通知发送失败。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
