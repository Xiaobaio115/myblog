import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function parseDevice(ua: string): string {
  if (!ua) return "未知设备";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    const m = ua.match(/Android[^;]*;\s*([^)]+)/);
    return m ? m[1].trim() : "Android";
  }
  if (/Windows NT/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "其他";
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const pw = request.headers.get("x-admin-password");
    const adminPw = process.env.ADMIN_PASSWORD || "admin";
    const isAdmin = pw === adminPw;

    const query = isAdmin ? {} : { approved: true };
    const messages = await db
      .collection("guestbook")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json(
      messages.map((m) => ({
        _id: String(m._id),
        name: String(m.name ?? "匿名"),
        website: m.website ? String(m.website) : "",
        message: String(m.message ?? ""),
        approved: !!m.approved,
        createdAt: m.createdAt ? String(m.createdAt) : "",
        ...(isAdmin ? {
          email: String(m.email ?? ""),
          ip: String(m.ip ?? ""),
          device: String(m.device ?? ""),
          userAgent: String(m.userAgent ?? ""),
        } : {}),
      }))
    );
  } catch (error) {
    console.error("GET /api/guestbook error:", error);
    return NextResponse.json({ error: "读取留言失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 50);
    const email = String(body.email ?? "").trim().slice(0, 100);
    const website = String(body.website ?? "").trim().slice(0, 200);
    const message = String(body.message ?? "").trim().slice(0, 600);
    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIp(request);
    const device = parseDevice(userAgent);

    if (!name) {
      return NextResponse.json({ error: "昵称不能为空。" }, { status: 400 });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "请填写有效的邮箱地址（不会公开）。" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "留言内容不能为空。" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();

    await db.collection("guestbook").insertOne({
      name,
      email,
      website,
      message,
      ip,
      device,
      userAgent,
      approved: true,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/guestbook error:", error);
    return NextResponse.json({ error: "提交留言失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const pw = request.headers.get("x-admin-password");
    const adminPw = process.env.ADMIN_PASSWORD || "admin";
    if (pw !== adminPw) return NextResponse.json({ error: "无权限" }, { status: 401 });

    const { id, approved } = await request.json();
    const db = await getDb();
    await db.collection("guestbook").updateOne(
      { _id: new ObjectId(id) },
      { $set: { approved: !!approved } }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/guestbook error:", error);
    return NextResponse.json({ error: "操作失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const pw = request.headers.get("x-admin-password");
    const adminPw = process.env.ADMIN_PASSWORD || "admin";
    if (pw !== adminPw) return NextResponse.json({ error: "无权限" }, { status: 401 });

    const { id } = await request.json();
    const db = await getDb();
    await db.collection("guestbook").deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/guestbook error:", error);
    return NextResponse.json({ error: "删除失败。" }, { status: 500 });
  }
}
