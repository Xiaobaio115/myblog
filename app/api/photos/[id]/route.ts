import { del } from "@vercel/blob";
import { ObjectId } from "mongodb";
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

function getPhotoId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin(request);

    if (authError) {
      return authError;
    }

    const { id } = await params;
    const photoId = getPhotoId(id);

    if (!photoId) {
      return NextResponse.json({ error: "照片 ID 无效" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ("caption" in body) {
      updates.caption = String(body.caption || "").trim();
    }

    if ("category" in body) {
      updates.category = String(body.category || "").trim();
    }

    if ("isPrivate" in body) {
      updates.isPrivate = Boolean(body.isPrivate);
    }

    const db = await getDb();
    const result = await db.collection("photos").findOneAndUpdate(
      { _id: photoId },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      photo: {
        ...result,
        _id: result._id.toString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/photos/[id] error:", error);
    return NextResponse.json({ error: "更新照片失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin(request);

    if (authError) {
      return authError;
    }

    const { id } = await params;
    const photoId = getPhotoId(id);

    if (!photoId) {
      return NextResponse.json({ error: "照片 ID 无效" }, { status: 400 });
    }

    const db = await getDb();
    const photo = await db.collection("photos").findOne({ _id: photoId });

    if (!photo) {
      return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    }

    if (photo.pathname) {
      await del(String(photo.pathname));
    }

    await db.collection("photos").deleteOne({ _id: photoId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/photos/[id] error:", error);
    return NextResponse.json({ error: "删除照片失败" }, { status: 500 });
  }
}
