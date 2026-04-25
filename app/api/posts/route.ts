import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();

    const posts = await db
      .collection("posts")
      .find({ published: true })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      posts.map((post) => ({
        ...post,
        _id: String(post._id),
      }))
    );
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

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "后台密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim();
    const excerpt = String(body.excerpt || "").trim();
    const content = String(body.content || "").trim();
    const coverUrl = String(body.coverUrl || "").trim();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : [];

    if (!title) {
      return NextResponse.json({ error: "文章标题不能为空。" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "文章 slug 不能为空。" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "文章正文不能为空。" }, { status: 400 });
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
      published: body.published ?? true,
      views: 0,
      date: now.toLocaleDateString("zh-CN"),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("posts").insertOne(post);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("POST /api/posts error:", error);

    return NextResponse.json({ error: "发布文章失败。" }, { status: 500 });
  }
}
