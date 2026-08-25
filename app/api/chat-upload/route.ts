import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyAdminRequest } from "@/lib/admin-session";
import { getAiBehavior } from "@/lib/ai-behavior-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 聊天附件直传令牌。
 *
 * 为什么需要这条路由：Vercel Functions 的请求体上限是 4.5MB，而聊天原先把图片
 * 以 base64 内联进 JSON（还会膨胀约 33%），线上稍大的图片必定被平台拒绝。
 * 官方推荐做法是客户端直传 Blob，服务端只负责签发受限令牌。
 *
 * 这是访客可触达的写入入口，因此限额必须在服务端强制：
 * 类型白名单、单文件上限、以及按 IP 的每日上传次数节流。
 */

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

let indexesReady: Promise<void> | null = null;

/**
 * 配额表的索引。
 *
 * TTL 索引是必需的：现在每次上传都插一条记录，没有自动过期这张表会无限增长。
 * 过期时间取窗口上限 365 天，而不是当前配置值——后台随时可能把窗口调长，
 * 按当前值过期会把还在窗口内的记录提前删掉，等于放宽了限额。
 */
async function ensureUploadIndexes(db: Awaited<ReturnType<typeof getDb>>) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection("ai_upload_usage").createIndex({ ip: 1, createdAt: -1 }),
      db.collection("ai_upload_usage").createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 365 * 24 * 60 * 60 }
      ),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = null;
        throw error;
      });
  }
  await indexesReady;
}

/**
 * 按 IP 统计滑动窗口内的上传次数。
 *
 * 用「逐次插入 + 计数」而不是「按天累加计数器」：窗口可以由后台配成任意天数，
 * 固定的日期键无法表达跨天的滑动窗口。每条记录带 createdAt，配合 TTL 索引自动过期。
 *
 * 数据库不可用时放行，避免存储故障连带整个聊天上传不可用。
 */
async function consumeUploadQuota(ip: string, windowDays: number, limit: number) {
  try {
    const db = await getDb();
    await ensureUploadIndexes(db);
    const collection = db.collection("ai_upload_usage");
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const used = await collection.countDocuments({ ip, createdAt: { $gte: since } });
    if (used >= limit) return { allowed: false, used, limit };

    await collection.insertOne({ ip, createdAt: new Date() });
    return { allowed: true, used: used + 1, limit };
  } catch {
    return { allowed: true, used: 0, limit };
  }
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "服务端尚未配置 BLOB_READ_WRITE_TOKEN，无法上传附件。" },
      { status: 503 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  const isAdmin = verifyAdminRequest(request);
  const ip = getClientIp(request);
  const behavior = await getAiBehavior();

  if (!behavior.uploadEnabled && !isAdmin) {
    return NextResponse.json({ error: "站长已关闭聊天附件上传。" }, { status: 403 });
  }

  // 这条路由会收到两类请求：客户端来要令牌，以及上传完成后 Blob 服务端回调。
  // 只有前者才代表一次真实上传，回调请求的来源 IP 是 Vercel 而非用户，扣它没有意义。
  if (!isAdmin && body?.type === "blob.generate-client-token") {
    const quota = await consumeUploadQuota(
      ip,
      behavior.uploadWindowDays,
      behavior.uploadLimitPerWindow
    );
    if (!quota.allowed) {
      const window = behavior.uploadWindowDays === 1 ? "今日" : `最近 ${behavior.uploadWindowDays} 天`;
      return NextResponse.json(
        { error: `${window}上传次数已达上限（${quota.limit} 次），请稍后再试。` },
        { status: 429 }
      );
    }
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
        validUntil: Date.now() + behavior.uploadTokenTtlMinutes * 60 * 1000,
        tokenPayload: JSON.stringify({ ip, isAdmin }),
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/chat-upload error:", error);
    const message = error instanceof Error ? error.message : "附件上传失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
