import { NextResponse } from "next/server";
import { getAiBehavior } from "@/lib/ai-behavior-settings";
import { getConversationPolicy, detachVisitorConversationsFromProject } from "@/lib/ai-conversations";
import { detachDeveloperConversationsFromProject } from "@/lib/ai-developer-conversations";
import { resolveProjectOwner, wantsDeveloperProject } from "@/lib/ai-project-owner";
import { deleteProject, getProject, updateProject } from "@/lib/ai-projects";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置数据库。" }, { status: 503 });
    }
    const { id } = await context.params;
    const resolved = resolveProjectOwner(request, wantsDeveloperProject(request));
    if (!resolved) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    const db = await getDb();
    const project = await getProject(db, id, resolved.owner);
    if (!project) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    console.error("GET /api/ai-projects/[id] error:", error);
    return NextResponse.json({ error: "读取项目失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置数据库。" }, { status: 503 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const resolved = resolveProjectOwner(request, wantsDeveloperProject(request));
    if (!resolved) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    const db = await getDb();
    const result = await updateProject({
      db,
      id,
      owner: resolved.owner,
      // 只把请求里真正出现的字段传下去：undefined 表示不改动，
      // 而空串/空数组是「清空指令」「删掉所有文件」这两个合法目标值。
      ...(Object.prototype.hasOwnProperty.call(body, "name") ? { name: body.name } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "instructions") ? { instructions: body.instructions } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "files") ? { files: body.files } : {}),
      retentionDays: policy.retentionDays,
    });
    if (!result.project) {
      return NextResponse.json({ error: result.error }, { status: result.error === "项目不存在。" ? 404 : 400 });
    }
    return NextResponse.json({ project: result.project });
  } catch (error) {
    console.error("PATCH /api/ai-projects/[id] error:", error);
    return NextResponse.json({ error: "保存项目失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置数据库。" }, { status: 503 });
    }
    const { id } = await context.params;
    const resolved = resolveProjectOwner(request, wantsDeveloperProject(request));
    if (!resolved) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    const db = await getDb();

    // 先确认项目存在且归自己：退回会话是有副作用的写操作，
    // 放在归属校验之前的话，一个注定 404 的请求也会先把会话的 projectId 清掉。
    if (!(await getProject(db, id, resolved.owner))) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }

    // 再退回会话，最后删项目：反过来的话，若退回失败，会话就永久指向一个
    // 不存在的项目 id，在界面上等于凭空消失。
    const detached = resolved.owner.group === "developer"
      ? await detachDeveloperConversationsFromProject({ db, projectId: id })
      : await detachVisitorConversationsFromProject({
          db,
          visitorHash: resolved.owner.visitorHash,
          projectId: id,
        });

    const deleted = await deleteProject(db, id, resolved.owner);
    if (!deleted) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    return NextResponse.json({ success: true, detachedConversations: detached });
  } catch (error) {
    console.error("DELETE /api/ai-projects/[id] error:", error);
    return NextResponse.json({ error: "删除项目失败。" }, { status: 500 });
  }
}
