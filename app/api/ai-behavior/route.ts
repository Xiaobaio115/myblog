import { NextResponse } from "next/server";
import { getAiBehavior, saveAiBehavior } from "@/lib/ai-behavior-settings";
import { verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return "服务端尚未配置 ADMIN_PASSWORD。";
  }
  if (!verifyAdminPassword(request.headers.get("x-admin-password"))) {
    return "密码错误。";
  }
  return null;
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    return NextResponse.json(await getAiBehavior());
  } catch (error) {
    console.error("GET /api/ai-behavior error:", error);
    return NextResponse.json({ error: "读取 AI 行为配置失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const body = await request.json();
    const updated = await saveAiBehavior(body);
    return NextResponse.json({ success: true, behavior: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存 AI 行为配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
