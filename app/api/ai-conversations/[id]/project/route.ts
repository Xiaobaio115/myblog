import { NextResponse } from "next/server";
import {
  getVisitorIdentity,
  setVisitorConversationProject,
} from "@/lib/ai-conversations";
import { getProject } from "@/lib/ai-projects";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 只改会话的项目归属，不动消息内容。
 *
 * 单独开一个路由而不是复用 PATCH /[id]：那个接口按整份消息覆盖保存，
 * 从侧栏移动一条「当前没打开」的会话时客户端手里没有它的消息，
 * 走那条路就会把会话内容清空。
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置会话数据库。" }, { status: 503 });
    }
    const visitor = getVisitorIdentity(request);
    if (!visitor) return NextResponse.json({ error: "会话不存在或已过期。" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const { id } = await params;
    const db = await getDb();
    // 空串是合法目标值：表示移出项目、退回未分组。
    const projectId = String(body?.projectId || "").trim();

    // 目标项目必须存在且归同一个访客。不校验的话可以把会话指向别人的项目 id：
    // 读不到那个项目的内容，但会话会从自己的分组里消失，且不随对方删项目而退回。
    if (projectId && !(await getProject(db, projectId, { group: "visitor", visitorHash: visitor.hash }))) {
      return NextResponse.json({ error: "目标项目不存在。" }, { status: 404 });
    }

    const conversation = await setVisitorConversationProject({
      db,
      id,
      visitorHash: visitor.hash,
      projectId,
    });
    return conversation
      ? NextResponse.json({ conversation })
      : NextResponse.json({ error: "会话不存在或已过期。" }, { status: 404 });
  } catch (error) {
    console.error("PATCH /api/ai-conversations/[id]/project error:", error);
    return NextResponse.json({ error: "移动会话失败。" }, { status: 500 });
  }
}
