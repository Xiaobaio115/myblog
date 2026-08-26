import { NextResponse } from "next/server";
import { getAiBehavior, type AiMode } from "@/lib/ai-behavior-settings";
import {
  deleteVisitorConversation,
  getConversationPolicy,
  getVisitorConversation,
  getVisitorIdentity,
  updateVisitorConversation,
} from "@/lib/ai-conversations";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function missingVisitor() {
  return NextResponse.json({ error: "会话不存在或已过期。" }, { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const visitor = getVisitorIdentity(request);
    if (!visitor) return missingVisitor();
    const { id } = await params;
    const conversation = await getVisitorConversation(await getDb(), id, visitor.hash);
    return conversation ? NextResponse.json({ conversation }) : missingVisitor();
  } catch (error) {
    console.error("GET /api/ai-conversations/[id] error:", error);
    return NextResponse.json({ error: "读取会话失败。" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const visitor = getVisitorIdentity(request);
    if (!visitor) return missingVisitor();
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    if (!policy.enabled) {
      return NextResponse.json({ error: "当前未开启会话记录。" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const mode = behavior.enabledModes.includes(body?.mode as AiMode)
      ? body.mode as AiMode
      : behavior.mode;
    const { id } = await params;
    const conversation = await updateVisitorConversation({
      db: await getDb(),
      id,
      visitorHash: visitor.hash,
      mode,
      messages: body?.messages,
      maxUserMessageLength: behavior.maxMessageLength,
      retentionDays: policy.retentionDays,
      // 刻意不接受 projectId：这个接口每发一条消息都会调用一次，
      // 归属只在「移动」时改变，走 PATCH /[id]/project——那里会校验目标项目
      // 是否存在且归自己。两个接口都能改归属的话，校验早晚会漏掉一处。
    });
    return conversation ? NextResponse.json({ conversation }) : missingVisitor();
  } catch (error) {
    console.error("PATCH /api/ai-conversations/[id] error:", error);
    return NextResponse.json({ error: "保存会话失败。" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const visitor = getVisitorIdentity(request);
    if (!visitor) return missingVisitor();
    const { id } = await params;
    const deleted = await deleteVisitorConversation(await getDb(), id, visitor.hash);
    return deleted ? NextResponse.json({ success: true }) : missingVisitor();
  } catch (error) {
    console.error("DELETE /api/ai-conversations/[id] error:", error);
    return NextResponse.json({ error: "删除会话失败。" }, { status: 500 });
  }
}
