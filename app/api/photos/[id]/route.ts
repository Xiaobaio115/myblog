import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ id: string }>;
};

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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "照片 ID 无效。" }, { status: 400 });
    }

    const db = await getDb();
    await db.collection("photos").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/photos/[id] error:", error);

    return NextResponse.json({ error: "删除照片失败。" }, { status: 500 });
  }
}
