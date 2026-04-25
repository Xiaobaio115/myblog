import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const db = await getDb();

    const query =
      category && category !== "全部"
        ? { category }
        : {};

    const photos = await db
      .collection("photos")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      photos.map((photo: any) => ({
        ...photo,
        _id: photo._id.toString(),
      }))
    );
  } catch (error) {
    console.error("GET /api/photos error:", error);

    return NextResponse.json(
      { error: "读取相册失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminPassword = request.headers.get("x-admin-password");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务器未配置 ADMIN_PASSWORD" },
        { status: 500 }
      );
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "未授权，后台密码错误" },
        { status: 401 }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "服务器未配置 BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");
    const caption = String(formData.get("caption") || "我的照片").trim();
    const category = String(formData.get("category") || "日常").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "没有收到图片文件" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "只能上传图片文件" },
        { status: 400 }
      );
    }

    const maxSize = 8 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "图片不能超过 8MB，请先压缩图片" },
        { status: 413 }
      );
    }

    const safeCategory = category.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, "");
    const safeName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    const pathname = `photos/${safeCategory || "default"}/${Date.now()}-${
      safeName || "image.jpg"
    }`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const now = new Date();

    const photo = {
      url: blob.url,
      pathname: blob.pathname,
      caption,
      category,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const result = await db.collection("photos").insertOne(photo);

    return NextResponse.json({
      success: true,
      photo: {
        ...photo,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/photos error:", error);

    return NextResponse.json(
      { error: "上传图片失败，请检查 Vercel 日志" },
      { status: 500 }
    );
  }
}