import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPhotoId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const photoId = getPhotoId(id);
    if (!photoId) {
      return NextResponse.json({ error: "照片 ID 无效" }, { status: 400 });
    }

    const db = await getDb();
    const list = await db
      .collection("photo_comments")
      .find({ photoId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json({
      comments: list.map((c) => ({
        _id: c._id.toString(),
        author: c.author,
        content: c.content,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/photos/[id]/comments error:", error);
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const photoId = getPhotoId(id);
    if (!photoId) {
      return NextResponse.json({ error: "照片 ID 无效" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const author = String(body.author || "").trim().slice(0, 40) || "匿名";
    const content = String(body.content || "").trim().slice(0, 500);

    if (!content) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    }

    const db = await getDb();
    // make sure the photo exists
    const photo = await db.collection("photos").findOne({ _id: photoId }, { projection: { _id: 1 } });
    if (!photo) {
      return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    }

    const doc = {
      photoId,
      author,
      content,
      createdAt: new Date(),
    };
    const result = await db.collection("photo_comments").insertOne(doc);

    return NextResponse.json({
      success: true,
      comment: {
        _id: result.insertedId.toString(),
        author,
        content,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/photos/[id]/comments error:", error);
    return NextResponse.json({ error: "提交评论失败" }, { status: 500 });
  }
}
