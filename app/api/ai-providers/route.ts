import { NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/admin-session";
import { getAdminAiProviderPool, saveAdminAiProviderPool } from "@/lib/ai-provider-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  if (!process.env.ADMIN_PASSWORD) return "服务端尚未配置 ADMIN_PASSWORD。";
  if (!verifyAdminPassword(request.headers.get("x-admin-password"))) return "密码错误。";
  return null;
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    return NextResponse.json(await getAdminAiProviderPool());
  } catch (error) {
    console.error("GET /api/ai-providers error:", error);
    return NextResponse.json({ error: "读取模型池失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = authorize(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    return NextResponse.json({ success: true, pool: await saveAdminAiProviderPool(await request.json()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存模型池失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
