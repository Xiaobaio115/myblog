import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const db = await getDb();

  const post = await db.collection("posts").findOne({
    slug,
    published: true,
  });

  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  await db.collection("posts").updateOne(
    { slug },
    {
      $inc: { views: 1 },
      $set: { updatedAt: new Date() },
    }
  );

  return NextResponse.json(post);
}
