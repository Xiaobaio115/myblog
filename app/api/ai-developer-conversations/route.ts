import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-session";
import {
  createDeveloperConversation,
  listDeveloperConversations,
} from "@/lib/ai-developer-conversations";
import { getProject } from "@/lib/ai-projects";
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
    const db = await getDb();
    // 校验目标项目存在，理由同 [id]/project 路由。
    const requestedProjectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const projectId = requestedProjectId
      && await getProject(db, requestedProjectId, { group: "developer" })
      ? requestedProjectId
      : "";

    const conversation = await createDeveloperConversation({
      db,
      modelId: String(body?.modelId || ""),
      instructions: body?.instructions,
      messages: body?.messages,
      projectId,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/ai-developer-conversations error:", error);
    return NextResponse.json({ error: "创建开发者会话失败。" }, { status: 500 });
  }
}

/*
  这里原来有一个 DELETE，用来一次清空全部开发者会话。已移除，理由同访客侧。
  开发者会话不会自动过期，是长期积累的记录，一次误调用的代价比访客侧更高。
  站长确实需要清空时走 /api/ai-conversations/admin：那里要求密码，
  并且必须显式指明分组，少传或拼错会报 400 而不是按默认组删。
*/
