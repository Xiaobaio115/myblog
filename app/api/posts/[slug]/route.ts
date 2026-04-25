import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function toPostPayload(post: Record<string, unknown> & { _id: { toString(): string } }) {
  return {
    ...post,
    _id: post._id.toString(),
  };
}

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const post = await db.collection("posts").findOne({ slug });

    if (!post) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    return NextResponse.json(toPostPayload(post as typeof post & { _id: { toString(): string } }));
  } catch (error) {
    console.error("GET /api/posts/[slug] error:", error);

    return NextResponse.json({ error: "读取文章失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
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

    const { slug: currentSlug } = await params;
    const body = await request.json();

    const title = String(body.title || "").trim();
    const nextSlug = String(body.slug || "").trim();
    const excerpt = String(body.excerpt || "").trim();
    const content = String(body.content || "").trim();
    const coverUrl = String(body.coverUrl || "").trim();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : [];
    const published = body.published ?? true;

    if (!title) {
      return NextResponse.json({ error: "文章标题不能为空。" }, { status: 400 });
    }

    if (!nextSlug) {
      return NextResponse.json({ error: "文章 slug 不能为空。" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "文章正文不能为空。" }, { status: 400 });
    }

    const db = await getDb();
    const existingPost = await db.collection("posts").findOne({ slug: currentSlug });

    if (!existingPost) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    if (nextSlug !== currentSlug) {
      const duplicated = await db.collection("posts").findOne({ slug: nextSlug });

      if (duplicated) {
        return NextResponse.json(
          { error: "新的 slug 已存在，请换一个。" },
          { status: 409 }
        );
      }
    }

    const now = new Date();

    await db.collection("posts").updateOne(
      { slug: currentSlug },
      {
        $set: {
          title,
          slug: nextSlug,
          excerpt,
          content,
          coverUrl,
          tags,
          published: Boolean(published),
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      slug: nextSlug,
    });
  } catch (error) {
    console.error("PATCH /api/posts/[slug] error:", error);

    return NextResponse.json({ error: "保存文章失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
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

    const { slug } = await params;
    const db = await getDb();
    const result = await db.collection("posts").deleteOne({ slug });

    if (!result.deletedCount) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/posts/[slug] error:", error);

    return NextResponse.json({ error: "删除文章失败。" }, { status: 500 });
  }
}
