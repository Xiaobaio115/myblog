import { del } from "@vercel/blob";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminPassword = request.headers.get("x-admin-password");

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "未授权，后台密码错误" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "照片 ID 无效" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const photo = await db.collection("photos").findOne({
      _id: new ObjectId(id),
    });

    if (!photo) {
      return NextResponse.json(
        { error: "照片不存在" },
        { status: 404 }
      );
    }

    if (photo.pathname) {
      await del(photo.pathname);
    }

    await db.collection("photos").deleteOne({
      _id: new ObjectId(id),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/photos/[id] error:", error);

    return NextResponse.json(
      { error: "删除照片失败" },
      { status: 500 }
    );
  }
}