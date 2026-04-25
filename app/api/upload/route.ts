import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPassword = request.headers.get("x-admin-password");

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "没有上传文件" }, { status: 400 });
  }

  const blob = await put(file.name, file, {
    access: "public",
  });

  return NextResponse.json({
    url: blob.url,
  });
}
