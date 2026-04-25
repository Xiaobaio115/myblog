import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

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

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
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
    const onlyPublic = searchParams.get("public") === "1";
    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (category && category !== "全部") {
      query.category = category;
    }

    if (onlyPublic) {
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
    let isPrivate = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      url = String(body.url || "").trim();
      pathname = String(body.pathname || "").trim();
      caption = String(body.caption || "我的照片").trim();
      category = String(body.category || "日常").trim();
      isPrivate = Boolean(body.isPrivate);
    } else {
      const formData = await request.formData();
      url = String(formData.get("url") || "").trim();
      pathname = String(formData.get("pathname") || "").trim();
      caption = String(formData.get("caption") || "我的照片").trim();
      category = String(formData.get("category") || "日常").trim();
      isPrivate = String(formData.get("isPrivate") || "") === "true";
    }

    if (!url) {
      return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
    }

    const now = new Date();
    const photo = {
      url,
      pathname,
      caption,
      category,
      isPrivate,
      date: now.toLocaleDateString("zh-CN"),
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
