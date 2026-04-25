import { NextResponse } from "next/server";
import { trackPostView } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function getClientIp(request: Request) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "";

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

function getPlatform(userAgent: string) {
  if (/iphone/i.test(userAgent)) {
    return "iOS";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPadOS";
  }

  if (/android/i.test(userAgent)) {
    return "Android";
  }

  if (/windows nt/i.test(userAgent)) {
    return "Windows";
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    return "macOS";
  }

  if (/linux/i.test(userAgent)) {
    return "Linux";
  }

  return "Unknown platform";
}

function getBrowser(userAgent: string) {
  if (/micromessenger/i.test(userAgent)) {
    return "WeChat";
  }

  if (/edg\//i.test(userAgent)) {
    return "Edge";
  }

  if (/opr\//i.test(userAgent)) {
    return "Opera";
  }

  if (/chrome\//i.test(userAgent)) {
    return "Chrome";
  }

  if (/firefox\//i.test(userAgent)) {
    return "Firefox";
  }

  if (/safari\//i.test(userAgent) && /version\//i.test(userAgent)) {
    return "Safari";
  }

  return "Unknown browser";
}

function getDevice(userAgent: string) {
  const androidModel = userAgent.match(/Android [^;]+;\s*([^;)]+?)\s+Build\//i);

  if (androidModel?.[1]) {
    return androidModel[1].replace(/_/g, " ").trim();
  }

  if (/iphone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad";
  }

  if (/android/i.test(userAgent)) {
    return /mobile/i.test(userAgent) ? "Android 手机" : "Android 设备";
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    return "Mac";
  }

  if (/windows nt/i.test(userAgent)) {
    return "Windows PC";
  }

  if (/linux/i.test(userAgent)) {
    return "Linux 设备";
  }

  if (/bot|spider|crawler/i.test(userAgent)) {
    return "Bot";
  }

  return "Unknown device";
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const userAgent = request.headers.get("user-agent") || "";
    const views = await trackPostView(slug, {
      ip: getClientIp(request),
      device: getDevice(userAgent),
      platform: getPlatform(userAgent),
      browser: getBrowser(userAgent),
      userAgent,
    });

    return NextResponse.json({ success: true, views });
  } catch (error) {
    console.error("POST /api/posts/[slug]/view error:", error);

    if (error instanceof Error && error.message === "Post not found") {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    return NextResponse.json({ error: "记录浏览信息失败。" }, { status: 500 });
  }
}
