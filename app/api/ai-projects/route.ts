import { NextResponse } from "next/server";
import { getAiBehavior } from "@/lib/ai-behavior-settings";
import { attachVisitorCookie, getConversationPolicy } from "@/lib/ai-conversations";
import { resolveProjectOwner, wantsDeveloperProject } from "@/lib/ai-project-owner";
import { createProject, listProjects } from "@/lib/ai-projects";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ storageAvailable: false, projects: [] });
    }
    const resolved = resolveProjectOwner(request, wantsDeveloperProject(request));
    if (!resolved) {
      // 访客还没有 Cookie，说明也不可能有项目
      return NextResponse.json({ storageAvailable: true, projects: [] });
    }
    const db = await getDb();
    const projects = await listProjects(db, resolved.owner);
    return NextResponse.json({ storageAvailable: true, projects });
  } catch (error) {
    console.error("GET /api/ai-projects error:", error);
    return NextResponse.json({ error: "读取项目失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置数据库，无法保存项目。" }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const resolved = resolveProjectOwner(request, wantsDeveloperProject(request), true);
    if (!resolved) {
      return NextResponse.json({ error: "无法识别访客身份。" }, { status: 400 });
    }
    const behavior = await getAiBehavior();
    const policy = getConversationPolicy(behavior);
    // 访客侧：会话记录关掉时不允许建项目。项目是会话的容器，
    // 会话根本存不下来的话，建出来的项目永远是空的，只会让人以为功能坏了。
    // 开发者会话不受这个开关控制，所以只拦访客。
    if (resolved.owner.group === "visitor" && !policy.enabled) {
      return NextResponse.json({ error: "当前未开启会话记录，无法创建项目。" }, { status: 403 });
    }
    const db = await getDb();
    const result = await createProject({
      db,
      owner: resolved.owner,
      name: body?.name,
      instructions: body?.instructions,
      files: body?.files,
      retentionDays: policy.retentionDays,
    });
    if (!result.project) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const response = NextResponse.json({ project: result.project });
    attachVisitorCookie(response, resolved.visitor);
    return response;
  } catch (error) {
    console.error("POST /api/ai-projects error:", error);
    return NextResponse.json({ error: "创建项目失败。" }, { status: 500 });
  }
}
