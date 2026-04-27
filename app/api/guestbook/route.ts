import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const messages = await db
      .collection("guestbook")
      .find({ approved: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(
      messages.map((m) => ({
        _id: String(m._id),
        name: String(m.name ?? "匿名"),
        website: m.website ? String(m.website) : "",
        message: String(m.message ?? ""),
        createdAt: m.createdAt ? String(m.createdAt) : "",
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

    if (!name) {
      return NextResponse.json({ error: "昵称不能为空。" }, { status: 400 });
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
      approved: true,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/guestbook error:", error);
    return NextResponse.json({ error: "提交留言失败。" }, { status: 500 });
  }
}
