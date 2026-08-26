import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-session";
import { setDeveloperConversationProject } from "@/lib/ai-developer-conversations";
import { getProject } from "@/lib/ai-projects";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 只改归属，不动消息。理由同访客侧的同名路由。 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "管理员身份已失效，请重新登录。" }, { status: 401 });
  }
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置会话数据库。" }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const { id } = await params;
    const db = await getDb();
    const projectId = String(body?.projectId || "").trim();

    // 目标项目必须存在且属于开发者组。不校验的话会话可以指向一个解析不出的
    // 项目 id，那种会话在侧栏里既不在项目下也不在未分组里，等于消失。
    if (projectId && !(await getProject(db, projectId, { group: "developer" }))) {
      return NextResponse.json({ error: "目标项目不存在。" }, { status: 404 });
    }

    const conversation = await setDeveloperConversationProject({
      db,
      id,
      projectId,
    });
    return conversation
      ? NextResponse.json({ conversation })
      : NextResponse.json({ error: "开发者会话不存在。" }, { status: 404 });
  } catch (error) {
    console.error("PATCH /api/ai-developer-conversations/[id]/project error:", error);
    return NextResponse.json({ error: "移动会话失败。" }, { status: 500 });
  }
}
