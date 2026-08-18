import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/content";
import { getDb } from "@/lib/mongodb";
import { verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await getPublishedPosts(100);
    return NextResponse.json(posts);
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: "读取文章失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
const adminPassword = request.headers.get("x-admin-password");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务端尚未配置 ADMIN_PASSWORD。" },
        { status: 500 }
      );
    }

    if (!verifyAdminPassword(adminPassword)) {
      return NextResponse.json({ error: "后台密码错误。" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
    }
    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim();
    const excerpt = String(body.excerpt || "").trim();
    const content = String(body.content || "").trim();
    const coverUrl = String(body.coverUrl || "").trim();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : [];
    const series = String(body.series || "").trim();
    const rawSeriesOrder = body.seriesOrder;
    const seriesOrder =
      rawSeriesOrder === undefined || rawSeriesOrder === null || rawSeriesOrder === ""
        ? undefined
        : Number(rawSeriesOrder);
    const published = body.published !== false;
    const isPrivate = Boolean(body.isPrivate);

    if (!title) {
      return NextResponse.json({ error: "文章标题不能为空。" }, { status: 400 });
    }

    if (title.length > 200 || excerpt.length > 1000 || content.length > 300000) {
      return NextResponse.json({ error: "文章标题、摘要或正文超出长度限制。" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "文章 slug 不能为空。" }, { status: 400 });
    }

    if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,159}$/u.test(slug)) {
      return NextResponse.json({ error: "文章 slug 格式不正确。" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "文章正文不能为空。" }, { status: 400 });
    }

    if (
      series &&
      seriesOrder !== undefined &&
      (!Number.isInteger(seriesOrder) || seriesOrder < 1)
    ) {
      return NextResponse.json(
        { error: "系列顺序必须是大于 0 的整数。" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existingPost = await db.collection("posts").findOne({ slug });

    if (existingPost) {
      return NextResponse.json(
        { error: "这个 slug 已存在，请换一个。" },
        { status: 409 }
      );
    }

    const now = new Date();
    const post = {
      title,
      slug,
      excerpt,
      content,
      coverUrl,
      tags,
      ...(series ? { series } : {}),
      ...(series && seriesOrder !== undefined ? { seriesOrder } : {}),
      published,
      isPrivate,
      views: 0,
      date: now.toLocaleDateString("zh-CN"),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("posts").insertOne(post);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
      slug,
    });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "发布文章失败。" }, { status: 500 });
  }
}
