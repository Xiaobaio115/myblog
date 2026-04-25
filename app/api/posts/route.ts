import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();

  const posts = await db
    .collection("posts")
    .find({ published: true })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const adminPassword = request.headers.get("x-admin-password");

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const body = await request.json();

  const db = await getDb();

  const post = {
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    content: body.content,
    coverUrl: body.coverUrl || "",
    tags: body.tags || [],
    published: body.published ?? true,
    views: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("posts").insertOne(post);

  return NextResponse.json({
    success: true,
    id: result.insertedId,
  });
}
