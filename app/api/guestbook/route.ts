import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 40;
const MAX_EMAIL_LENGTH = 100;
const MAX_WEBSITE_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 2;
const COOLDOWN_SECONDS = 30;
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

let indexesReady: Promise<void> | null = null;

type GuestbookBody = {
  name?: unknown;
  email?: unknown;
  website?: unknown;
  message?: unknown;
  company?: unknown;
};

function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function parseDevice(ua: string): string {
  if (!ua) return "未知设备";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]+)/);
    return match ? match[1].trim() : "Android";
  }
  if (/Windows NT/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "其他设备";
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeMessage(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getWindowKey(prefix: string, id: string, seconds: number) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  return `${prefix}:${id}:${bucket}`;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function isAdminRequest(request: Request) {
  return verifyAdminPassword(request.headers.get("x-admin-password"));
}

function getUnauthorizedResponse() {
  if (!getAdminPassword()) {
    return NextResponse.json({ error: "服务端尚未配置 ADMIN_PASSWORD。" }, { status: 503 });
  }
  return NextResponse.json({ error: "无权操作。" }, { status: 401 });
}

async function ensureGuestbookIndexes(db: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection("guestbook_rate_limits").createIndex({ key: 1 }, { unique: true }),
      db.collection("guestbook_rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("guestbook").createIndex({ approved: 1, createdAt: -1 }),
      db.collection("guestbook").createIndex({ ip: 1, createdAt: -1 }),
      db.collection("guestbook").createIndex({ email: 1, createdAt: -1 }),
      db.collection("guestbook").createIndex({ messageHash: 1, createdAt: -1 }),
    ]).then(() => undefined);
  }
  await indexesReady;
}

async function hitRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  meta: Record<string, string>
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const result = await db.collection("guestbook_rate_limits").findOneAndUpdate(
    { key },
    {
      $setOnInsert: { key, ...meta, createdAt: now, expiresAt },
      $inc: { count: 1 },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );

  const count = Number(result?.count ?? 0);
  return count > limit;
}

async function parseJsonBody(request: Request): Promise<GuestbookBody | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as GuestbookBody) : null;
  } catch {
    return null;
  }
}

function normalizeWebsite(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().slice(0, MAX_WEBSITE_LENGTH);
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  try {
    const hasAdminHeader = Boolean(request.headers.get("x-admin-password"));
    const isAdmin = isAdminRequest(request);

    if (hasAdminHeader && !isAdmin) {
      return getUnauthorizedResponse();
    }

    if (!isMongoConfigured()) {
      return isAdmin
        ? NextResponse.json({ error: "服务器未配置 MONGODB_URI。" }, { status: 503 })
        : NextResponse.json([]);
    }

    const db = await getDb();

    const query = isAdmin ? {} : { approved: true };
    const messages = await db
      .collection("guestbook")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json(
      messages.map((message) => ({
        _id: String(message._id),
        name: String(message.name ?? "匿名"),
        website: message.website ? String(message.website) : "",
        message: String(message.message ?? ""),
        approved: !!message.approved,
        createdAt: message.createdAt ? String(message.createdAt) : "",
        ...(isAdmin
          ? {
              email: String(message.email ?? ""),
              ip: String(message.ip ?? ""),
              device: String(message.device ?? ""),
              userAgent: String(message.userAgent ?? ""),
              moderationStatus: String(message.moderationStatus ?? ""),
            }
          : {}),
      }))
    );
  } catch (error) {
    console.error("GET /api/guestbook error:", error);
    return NextResponse.json({ error: "读取留言失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    if (!body) {
      return NextResponse.json({ error: "提交内容格式不正确。" }, { status: 400 });
    }

    if (cleanText(body.company, 80)) {
      return NextResponse.json({ error: "提交失败，请稍后再试。" }, { status: 400 });
    }

    const name = cleanText(body.name, MAX_NAME_LENGTH);
    const email = cleanText(body.email, MAX_EMAIL_LENGTH).toLowerCase();
    const website = normalizeWebsite(cleanText(body.website, MAX_WEBSITE_LENGTH));
    const message = cleanText(body.message, MAX_MESSAGE_LENGTH);
    const normalizedMessage = normalizeMessage(message);
    const messageHash = hashText(normalizedMessage);
    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIp(request);
    const device = parseDevice(userAgent);

    if (!name) {
      return NextResponse.json({ error: "昵称不能为空。" }, { status: 400 });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "请填写有效的邮箱地址，邮箱不会公开。" }, { status: 400 });
    }
    if (message.length < MIN_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "留言内容太短了。" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `留言请控制在 ${MAX_MESSAGE_LENGTH} 字以内。` }, { status: 400 });
    }

    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置 MONGODB_URI。" }, { status: 503 });
    }
    const db = await getDb();
    await ensureGuestbookIndexes(db);

    const cooldownLimited = await hitRateLimit(
      db,
      getWindowKey("guestbook:cooldown:ip", ip, COOLDOWN_SECONDS),
      1,
      COOLDOWN_SECONDS,
      { ip, type: "cooldown" }
    );
    if (cooldownLimited) {
      return NextResponse.json({ error: "提交太频繁了，请半分钟后再试。" }, { status: 429 });
    }

    const hourlyLimited = await hitRateLimit(
      db,
      getWindowKey("guestbook:hour:ip", ip, 60 * 60),
      HOURLY_LIMIT,
      60 * 60,
      { ip, type: "hour" }
    );
    const dailyLimited = await hitRateLimit(
      db,
      `guestbook:day:${getTodayKey()}:${ip}:${email}`,
      DAILY_LIMIT,
      24 * 60 * 60,
      { ip, email, type: "day" }
    );

    if (hourlyLimited || dailyLimited) {
      return NextResponse.json({ error: "今天提交次数较多，请稍后再试。" }, { status: 429 });
    }

    const duplicate = await db.collection("guestbook").findOne({
      $or: [{ ip }, { email }],
      messageHash,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    });

    if (duplicate) {
      return NextResponse.json({ error: "这条留言刚刚已经提交过了。" }, { status: 409 });
    }

    const now = new Date();
    await db.collection("guestbook").insertOne({
      name,
      email,
      website,
      message,
      messageHash,
      ip,
      device,
      userAgent: userAgent.slice(0, 500),
      approved: false,
      moderationStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      pending: true,
      message: "留言已提交，审核后会显示在页面上。",
    });
  } catch (error) {
    console.error("POST /api/guestbook error:", error);
    return NextResponse.json({ error: "提交留言失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isAdminRequest(request)) return getUnauthorizedResponse();

    const body = await request.json().catch(() => null);
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    const approved = body && typeof body === "object" ? (body as { approved?: unknown }).approved : undefined;
    if (typeof id !== "string" || !ObjectId.isValid(id) || typeof approved !== "boolean") {
      return NextResponse.json({ error: "留言 ID 不正确。" }, { status: 400 });
    }

    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置 MONGODB_URI。" }, { status: 503 });
    }
    const db = await getDb();
    const result = await db.collection("guestbook").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          approved,
          moderationStatus: approved ? "approved" : "pending",
          updatedAt: new Date(),
        },
      }
    );
    if (!result.matchedCount) {
      return NextResponse.json({ error: "留言不存在。" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/guestbook error:", error);
    return NextResponse.json({ error: "操作失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isAdminRequest(request)) return getUnauthorizedResponse();

    const body = await request.json().catch(() => null);
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "留言 ID 不正确。" }, { status: 400 });
    }

    if (!isMongoConfigured()) {
      return NextResponse.json({ error: "服务器未配置 MONGODB_URI。" }, { status: 503 });
    }
    const db = await getDb();
    const result = await db.collection("guestbook").deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) {
      return NextResponse.json({ error: "留言不存在。" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/guestbook error:", error);
    return NextResponse.json({ error: "删除失败。" }, { status: 500 });
  }
}
