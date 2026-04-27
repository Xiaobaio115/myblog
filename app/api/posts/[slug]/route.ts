import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function toPostPayload(
  post: Record<string, unknown> & { _id: { toString(): string } }
) {
  return {
    ...post,
    _id: post._id.toString(),
  };
}

async function requireAdmin(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "服务端尚未配置 ADMIN_PASSWORD。" },
      { status: 500 }
    );
  }

  const adminPassword = request.headers.get("x-admin-password");

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "后台密码错误。" }, { status: 401 });
  }

  return null;
}

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const post = await db.collection("posts").findOne({ slug });

    if (!post) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    return NextResponse.json(
      toPostPayload(post as typeof post & { _id: { toString(): string } })
    );
  } catch (error) {
    console.error("GET /api/posts/[slug] error:", error);
    return NextResponse.json({ error: "读取文章失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const authError = await requireAdmin(request);

    if (authError) {
      return authError;
    }

    const { slug: currentSlug } = await params;
    const body = await request.json();

    const db = await getDb();
    const existingPost = await db.collection("posts").findOne({ slug: currentSlug });

    if (!existingPost) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    // 仅更新请求中实际提供且非空的字段，防止空值意外覆盖数据库内容
    const patch: Record<string, unknown> = {};

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const nextSlug = body.slug !== undefined ? String(body.slug).trim() : undefined;
    const content = body.content !== undefined ? String(body.content).trim() : undefined;

    if (title !== undefined) {
      if (!title) return NextResponse.json({ error: "文章标题不能为空。" }, { status: 400 });
      patch.title = title;
    }
    if (nextSlug !== undefined) {
      if (!nextSlug) return NextResponse.json({ error: "文章 slug 不能为空。" }, { status: 400 });
      if (nextSlug !== currentSlug) {
        const duplicated = await db.collection("posts").findOne({ slug: nextSlug });
        if (duplicated) {
          return NextResponse.json({ error: "新的 slug 已存在，请换一个。" }, { status: 409 });
        }
      }
      patch.slug = nextSlug;
    }
    if (content !== undefined) {
      if (!content) return NextResponse.json({ error: "文章正文不能为空。" }, { status: 400 });
      patch.content = content;
    }
    if (body.excerpt !== undefined) patch.excerpt = String(body.excerpt).trim();
    if (body.coverUrl !== undefined) patch.coverUrl = String(body.coverUrl).trim();
    if (body.tags !== undefined) {
      patch.tags = Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
        : [];
    }
    if (body.published !== undefined) patch.published = body.published !== false;
    if (body.isPrivate !== undefined) patch.isPrivate = Boolean(body.isPrivate);

    const resolvedNextSlug = (patch.slug as string | undefined) ?? currentSlug;
    patch.updatedAt = new Date();

    await db.collection("posts").updateOne(
      { slug: currentSlug },
      { $set: patch }
    );

    if (resolvedNextSlug !== currentSlug) {
      await db.collection("post_visits").updateMany(
        { slug: currentSlug },
        { $set: { slug: resolvedNextSlug } }
      );
    }

    return NextResponse.json({
      success: true,
      slug: resolvedNextSlug,
    });
  } catch (error) {
    console.error("PATCH /api/posts/[slug] error:", error);
    return NextResponse.json({ error: "保存文章失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  try {
    const authError = await requireAdmin(request);

    if (authError) {
      return authError;
    }

    const { slug } = await params;
    const { ObjectId } = await import("mongodb");
    const db = await getDb();

    let result = await db.collection("posts").deleteOne({ slug });

    if (!result.deletedCount) {
      const url = new URL(request.url);
      const postId = url.searchParams.get("_id");
      if (postId) {
        try {
          result = await db.collection("posts").deleteOne({ _id: new ObjectId(postId) });
        } catch {
          // invalid ObjectId format, ignore
        }
      }
    }

    if (!result.deletedCount) {
      return NextResponse.json({ error: "文章不存在。" }, { status: 404 });
    }

    await db.collection("post_visits").deleteMany({ slug });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/posts/[slug] error:", error);
    return NextResponse.json({ error: "删除文章失败。" }, { status: 500 });
  }
}
