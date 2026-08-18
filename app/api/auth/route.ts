import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  getAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const pwd = request.headers.get("x-admin-password");

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "服务器未配置 ADMIN_PASSWORD" }, { status: 500 });
  }

  if (!verifyAdminPassword(pwd)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    getAdminSessionToken()!,
    adminSessionCookieOptions
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
