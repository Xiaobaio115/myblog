import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const maxSize = 4 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "图片不能超过 4MB。请先压缩图片，或后面改成客户端直传 Blob。" },
        { status: 413 }
      );
    }

    const safeName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    const pathname = `blog-images/${Date.now()}-${safeName || "image.jpg"}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);

    return NextResponse.json(
      { error: "图片上传失败，请检查 Vercel 日志" },
      { status: 500 }
    );
  }
}
