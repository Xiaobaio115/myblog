import { NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "服务器未配置 ADMIN_PASSWORD" },
      { status: 500 }
    );
  }

  const adminPassword = request.headers.get("x-admin-password");

  if (!verifyAdminPassword(adminPassword)) {
    return NextResponse.json(
      { error: "未授权，后台密码错误" },
      { status: 401 }
    );
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const adminHeader = request.headers.get("x-admin-password");
    const hasAdminHeader = Boolean(adminHeader);

    if (hasAdminHeader && !process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务器未配置 ADMIN_PASSWORD" },
        { status: 503 }
      );
    }

    if (hasAdminHeader && !verifyAdminPassword(adminHeader)) {
      return NextResponse.json(
        { error: "未授权，后台密码错误" },
        { status: 401 }
      );
    }

    const isAdmin = hasAdminHeader && verifyAdminPassword(adminHeader);

    if (!isMongoConfigured()) {
      return isAdmin
        ? NextResponse.json(
            { error: "服务器未配置 MONGODB_URI" },
            { status: 503 }
          )
        : NextResponse.json([]);
    }

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (category && category !== "全部") {
      query.category = category;
    }

    if (!isAdmin || searchParams.get("public") === "1") {
      query.isPrivate = { $ne: true };
    }

    const photos = await db
      .collection("photos")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      photos.map((photo) => ({
        ...photo,
        _id: photo._id.toString(),
      }))
    );
  } catch (error) {
    console.error("GET /api/photos error:", error);
    return NextResponse.json({ error: "读取相册失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin(request);

    if (authError) {
      return authError;
    }

    const contentType = request.headers.get("content-type") || "";
    let url = "";
    let pathname = "";
    let caption = "我的照片";
    let category = "日常";
    let location = "";
    let date = "";
    let isPrivate = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      url = String(body.url || "").trim();
      pathname = String(body.pathname || "").trim();
      caption = String(body.caption || "我的照片").trim();
      category = String(body.category || "日常").trim();
      location = String(body.location || "").trim();
      date = String(body.date || "").trim();
      isPrivate = Boolean(body.isPrivate);
    } else {
      const formData = await request.formData();
      url = String(formData.get("url") || "").trim();
      pathname = String(formData.get("pathname") || "").trim();
      caption = String(formData.get("caption") || "我的照片").trim();
      category = String(formData.get("category") || "日常").trim();
      location = String(formData.get("location") || "").trim();
      date = String(formData.get("date") || "").trim();
      isPrivate = String(formData.get("isPrivate") || "") === "true";
    }

    if (!url) {
      return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
    }

    if (caption.length > 240 || category.length > 80 || location.length > 120 || date.length > 40) {
      return NextResponse.json({ error: "照片说明、分类、地点或日期过长。" }, { status: 400 });
    }

    const now = new Date();
    const photo = {
      url,
      pathname,
      caption,
      category,
      location,
      isPrivate,
      date: date || now.toLocaleDateString("zh-CN"),
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
      { error: "保存相册图片失败，请检查 Vercel 日志" },
      { status: 500 }
    );
  }
}
