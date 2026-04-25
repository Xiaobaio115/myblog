import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getStoredPhotos } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await getStoredPhotos(100);
  return NextResponse.json(photos);
}

export async function POST(request: Request) {
  try {
    const adminPassword = request.headers.get("x-admin-password");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务端尚未配置 ADMIN_PASSWORD。" },
        { status: 500 }
      );
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "后台密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const url = String(body.url || "").trim();
    const caption = String(body.caption || "").trim();

    if (!url) {
      return NextResponse.json({ error: "照片地址不能为空。" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();

    const result = await db.collection("photos").insertOne({
      url,
      caption: caption || "我的照片",
      date: now.toLocaleDateString("zh-CN"),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("POST /api/photos error:", error);

    return NextResponse.json({ error: "保存照片失败。" }, { status: 500 });
  }
}
