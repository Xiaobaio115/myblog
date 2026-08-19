import { NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/admin-session";
import { getAiBehavior } from "@/lib/ai-behavior-settings";
import {
  countAdminConversations,
  deleteAdminConversation,
  deleteAllAdminConversations,
  getAdminConversation,
  getConversationPolicy,
  listAdminConversations,
} from "@/lib/ai-conversations";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "服务端尚未配置 ADMIN_PASSWORD。" }, { status: 503 });
  }
  if (!verifyAdminPassword(request.headers.get("x-admin-password"))) {
    return NextResponse.json({ error: "无权操作。" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;
  try {
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    if (!isMongoConfigured()) {
      return NextResponse.json({ policy, storageAvailable: false, count: 0, conversations: [] });
    }
    const id = new URL(request.url).searchParams.get("id");
    const db = await getDb();
    if (id) {
      const conversation = await getAdminConversation(db, id);
      return conversation
        ? NextResponse.json({ conversation })
        : NextResponse.json({ error: "会话不存在。" }, { status: 404 });
    }
    const [conversations, count] = await Promise.all([
      listAdminConversations(db),
      countAdminConversations(db),
    ]);
    return NextResponse.json({ policy, storageAvailable: true, count, conversations });
  } catch (error) {
    console.error("GET /api/ai-conversations/admin error:", error);
    return NextResponse.json({ error: "读取 AI 会话失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;
  try {
    const body = await request.json().catch(() => ({}));
    const db = await getDb();
    if (body?.all === true) {
      const deletedCount = await deleteAllAdminConversations(db);
      return NextResponse.json({ success: true, deletedCount });
    }
    const id = typeof body?.id === "string" ? body.id : "";
    const deleted = await deleteAdminConversation(db, id);
    return deleted
      ? NextResponse.json({ success: true, deletedCount: 1 })
      : NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  } catch (error) {
    console.error("DELETE /api/ai-conversations/admin error:", error);
    return NextResponse.json({ error: "删除 AI 会话失败。" }, { status: 500 });
  }
}
