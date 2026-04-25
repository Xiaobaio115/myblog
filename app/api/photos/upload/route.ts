import { handleUpload } from "@vercel/blob/client";
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

    const body = await request.json();
    const result = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      request,
      body,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ["image/*"],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
        pathname,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/photos/upload error:", error);

    return NextResponse.json(
      { error: "生成直传令牌失败，请检查 Vercel 日志" },
      { status: 500 }
    );
  }
}
