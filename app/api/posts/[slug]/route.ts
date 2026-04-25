import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "缺少文章 slug" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const post = await db.collection("posts").findOne({
      slug,
      published: true,
    });

    if (!post) {
      return NextResponse.json(
        { error: "文章不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...post,
      _id: post._id.toString(),
    });
  } catch (error) {
    console.error("GET /api/posts/[slug] error:", error);

    return NextResponse.json(
      { error: "读取文章失败" },
      { status: 500 }
    );
  }
}
