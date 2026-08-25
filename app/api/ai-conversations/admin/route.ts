import { NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/admin-session";
import { getAiBehavior } from "@/lib/ai-behavior-settings";
import { isConversationGroup, normalizeConversationGroup } from "@/lib/ai-conversation-groups";
import {
  countAdminConversations,
  deleteAdminConversation,
  deleteAllAdminConversations,
  getAdminConversation,
  getConversationPolicy,
  listAdminConversations,
} from "@/lib/ai-conversations";
import {
  countDeveloperConversations,
  deleteAllDeveloperConversations,
  deleteDeveloperConversation,
  getDeveloperConversation,
  listDeveloperConversations,
} from "@/lib/ai-developer-conversations";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

/** 后台列表的显示上限。两组共用，避免一次请求拉回上千条把页面拖死。 */
const ADMIN_LIST_LIMIT = 100;

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
    const params = new URL(request.url).searchParams;
    // 读取用宽松归一：分组名认不出来就看默认那组，不该让后台页打不开。
    const group = normalizeConversationGroup(params.get("group"));
    if (!isMongoConfigured()) {
      return NextResponse.json({
        policy,
        storageAvailable: false,
        group,
        counts: { visitor: 0, developer: 0 },
        conversations: [],
      });
    }
    const id = params.get("id");
    const db = await getDb();
    if (id) {
      const conversation = group === "developer"
        ? await getDeveloperConversation(db, id)
        : await getAdminConversation(db, id);
      return conversation
        ? NextResponse.json({ group, conversation })
        : NextResponse.json({ error: "会话不存在。" }, { status: 404 });
    }
    // 两组的数量都返回：后台页要在分组切换器上直接显示条数，
    // 否则切一次组才能知道另一组有多少，看不出该清哪边。
    const [conversations, visitorCount, developerCount] = await Promise.all([
      group === "developer"
        ? listDeveloperConversations(db, ADMIN_LIST_LIMIT)
        : listAdminConversations(db, ADMIN_LIST_LIMIT),
      countAdminConversations(db),
      countDeveloperConversations(db),
    ]);
    return NextResponse.json({
      policy,
      storageAvailable: true,
      group,
      counts: { visitor: visitorCount, developer: developerCount },
      conversations,
    });
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
    // 删除必须显式指明分组，且不做回落。
    // 少传或拼错时如果按默认组处理，「本想清空开发者会话」会变成「清空了访客会话」，
    // 而这是不可逆的。宁可报 400 让调用方改对。
    if (!isConversationGroup(body?.group)) {
      return NextResponse.json({ error: "缺少或无效的会话分组。" }, { status: 400 });
    }
    const group = body.group;
    const db = await getDb();
    if (body?.all === true) {
      const deletedCount = group === "developer"
        ? await deleteAllDeveloperConversations(db)
        : await deleteAllAdminConversations(db);
      return NextResponse.json({ success: true, group, deletedCount });
    }
    const id = typeof body?.id === "string" ? body.id : "";
    const deleted = group === "developer"
      ? await deleteDeveloperConversation(db, id)
      : await deleteAdminConversation(db, id);
    return deleted
      ? NextResponse.json({ success: true, group, deletedCount: 1 })
      : NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  } catch (error) {
    console.error("DELETE /api/ai-conversations/admin error:", error);
    return NextResponse.json({ error: "删除 AI 会话失败。" }, { status: 500 });
  }
}
