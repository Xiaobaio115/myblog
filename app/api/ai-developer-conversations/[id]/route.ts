import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-session";
import {
  deleteDeveloperConversation,
  getDeveloperConversation,
  updateDeveloperConversation,
} from "@/lib/ai-developer-conversations";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "管理员身份已失效，请重新登录。" }, { status: 401 });
}

function missingConversation() {
  return NextResponse.json({ error: "开发者会话不存在。" }, { status: 404 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const conversation = await getDeveloperConversation(await getDb(), (await params).id);
    return conversation ? NextResponse.json({ conversation }) : missingConversation();
  } catch (error) {
    console.error("GET /api/ai-developer-conversations/[id] error:", error);
    return NextResponse.json({ error: "读取开发者会话失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const conversation = await updateDeveloperConversation({
      db: await getDb(),
      id: (await params).id,
      modelId: String(body?.modelId || ""),
      // 直接透传：normalizeInstructions 内部区分 undefined（保留）与空串（清空）。
      instructions: body?.instructions,
      messages: body?.messages,
      // 刻意不接受 projectId，理由同访客侧：归属只走 PATCH /[id]/project，
      // 那里会校验目标项目。留两个入口的话校验早晚漏掉一处。
    });
    return conversation ? NextResponse.json({ conversation }) : missingConversation();
  } catch (error) {
    console.error("PATCH /api/ai-developer-conversations/[id] error:", error);
    return NextResponse.json({ error: "保存开发者会话失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const deleted = await deleteDeveloperConversation(await getDb(), (await params).id);
    return deleted ? NextResponse.json({ success: true }) : missingConversation();
  } catch (error) {
    console.error("DELETE /api/ai-developer-conversations/[id] error:", error);
    return NextResponse.json({ error: "删除开发者会话失败。" }, { status: 500 });
  }
}
