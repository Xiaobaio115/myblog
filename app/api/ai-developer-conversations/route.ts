import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-session";
import {
  createDeveloperConversation,
  deleteAllDeveloperConversations,
  listDeveloperConversations,
} from "@/lib/ai-developer-conversations";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "管理员身份已失效，请重新登录。" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  if (!isMongoConfigured()) {
    return NextResponse.json({ enabled: false, reason: "database_unavailable", conversations: [] });
  }
  try {
    return NextResponse.json({
      enabled: true,
      persistent: true,
      conversations: await listDeveloperConversations(await getDb()),
      policy: { retentionDays: 0, maxPerVisitor: 0 },
    });
  } catch (error) {
    console.error("GET /api/ai-developer-conversations error:", error);
    return NextResponse.json({ error: "读取开发者会话失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "服务器未配置会话数据库。" }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const hasUserMessage = Array.isArray(body?.messages) && body.messages.some((message: unknown) => (
      Boolean(message && typeof message === "object" && (message as { role?: unknown }).role === "user" && String((message as { content?: unknown }).content || "").trim())
    ));
    if (!hasUserMessage) {
      return NextResponse.json({ error: "请先发送一条消息再创建会话。" }, { status: 400 });
    }
    const conversation = await createDeveloperConversation({
      db: await getDb(),
      modelId: String(body?.modelId || ""),
      instructions: body?.instructions,
      messages: body?.messages,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/ai-developer-conversations error:", error);
    return NextResponse.json({ error: "创建开发者会话失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const deletedCount = await deleteAllDeveloperConversations(await getDb());
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("DELETE /api/ai-developer-conversations error:", error);
    return NextResponse.json({ error: "清空开发者会话失败。" }, { status: 500 });
  }
}
