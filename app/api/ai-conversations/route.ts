import { NextResponse } from "next/server";
import { getAiBehavior, type AiMode } from "@/lib/ai-behavior-settings";
import {
  attachVisitorCookie,
  createVisitorConversation,
  deleteAllVisitorConversations,
  getConversationPolicy,
  getVisitorIdentity,
  listVisitorConversations,
} from "@/lib/ai-conversations";
import { getProject } from "@/lib/ai-projects";
import { getDb, isMongoConfigurationError, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveMode(value: unknown, enabledModes: AiMode[], fallback: AiMode) {
  return enabledModes.includes(value as AiMode) ? value as AiMode : fallback;
}

export async function GET(request: Request) {
  try {
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    const visitor = getVisitorIdentity(request);
    if (!policy.enabled || !visitor || !isMongoConfigured()) {
      return NextResponse.json({
        enabled: policy.enabled && isMongoConfigured(),
        reason: !policy.enabled ? "disabled" : !isMongoConfigured() ? "database_unavailable" : "no_history",
        policy,
        conversations: [],
      });
    }
    const db = await getDb();
    const conversations = await listVisitorConversations(db, visitor.hash);
    return NextResponse.json({ enabled: true, policy, conversations });
  } catch (error) {
    console.error("GET /api/ai-conversations error:", error);
    return NextResponse.json({ error: "读取会话记录失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    if (!policy.enabled) {
      return NextResponse.json({ error: "当前未开启会话记录。" }, { status: 403 });
    }
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置会话数据库。" }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const hasUserMessage = Array.isArray(body?.messages) && body.messages.some((message: unknown) => (
      Boolean(message && typeof message === "object" && (message as { role?: unknown }).role === "user" && String((message as { content?: unknown }).content || "").trim())
    ));
    if (!hasUserMessage) {
      return NextResponse.json({ error: "请先发送一条消息再创建会话。" }, { status: 400 });
    }
    const visitor = getVisitorIdentity(request, true)!;
    const mode = resolveMode(body?.mode, behavior.enabledModes, behavior.mode);
    const db = await getDb();

    // 校验目标项目归属，理由同 [id]/project 路由：未校验的 projectId 会让
    // 会话落在一个解析不出的分组里，在侧栏中既不在项目下也不在未分组里。
    const requestedProjectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const projectId = requestedProjectId
      && await getProject(db, requestedProjectId, { group: "visitor", visitorHash: visitor.hash })
      ? requestedProjectId
      : "";

    const conversation = await createVisitorConversation({
      db,
      visitorHash: visitor.hash,
      mode,
      messages: body?.messages,
      maxUserMessageLength: behavior.maxMessageLength,
      policy,
      projectId,
    });
    const response = NextResponse.json({ conversation }, { status: 201 });
    return attachVisitorCookie(response, visitor);
  } catch (error) {
    console.error("POST /api/ai-conversations error:", error);
    const message = isMongoConfigurationError(error) ? "服务器未配置会话数据库。" : "创建会话失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const visitor = getVisitorIdentity(request);
    if (!visitor) return NextResponse.json({ success: true, deletedCount: 0 });
    const db = await getDb();
    const deletedCount = await deleteAllVisitorConversations(db, visitor.hash);
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("DELETE /api/ai-conversations error:", error);
    return NextResponse.json({ error: "清空会话失败。" }, { status: 500 });
  }
}
