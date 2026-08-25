import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "lqpp_admin_session";
export const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getAdminSessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;

  return createHash("sha256")
    .update(`lqpp-admin-session:v1:${password}`)
    .digest("base64url");
}

export function verifyAdminPassword(candidate: string | null | undefined) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password && candidate && constantTimeEqual(candidate, password));
}

export function verifyAdminSessionToken(candidate: string | null | undefined) {
  const expected = getAdminSessionToken();
  return Boolean(expected && candidate && constantTimeEqual(candidate, expected));
}

function getCookieValue(request: Request, name: string) {
  const rawCookie = request.headers.get("cookie") || "";
  for (const item of rawCookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

export function verifyAdminRequest(request: Request) {
  return verifyAdminPassword(request.headers.get("x-admin-password")) ||
    verifyAdminSessionToken(getCookieValue(request, ADMIN_SESSION_COOKIE));
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE,
  priority: "high" as const,
};
