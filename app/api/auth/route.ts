import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const pwd = request.headers.get("x-admin-password");

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "服务器未配置 ADMIN_PASSWORD" }, { status: 500 });
  }

  if (pwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
