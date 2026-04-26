export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import StarPhotoWall from "./StarPhotoWall";

export default async function ThreeDPhotosPage() {
  const db = await getDb();

  const result = await db
    .collection("photos")
    .find({})
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray();

  const selectedCount = result.filter((photo: any) => photo.showIn3d).length;
  const selected =
    selectedCount > 0
      ? result.filter((photo: any) => photo.showIn3d)
      : result;

  const photos = selected
    .filter((photo: any) => String(photo.url || "").trim())
    .map((photo: any) => ({
      _id: photo._id.toString(),
      url: String(photo.url),
      caption: photo.caption || "我的照片",
      category: photo.category || "日常",
    }));

  return (
    <main>
      <div className="three-d-page-nav">
        <Link href="/photos">返回相册</Link>
        <span>3D 星空照片墙</span>
        <Link href="/admin/photos">上传照片</Link>
      </div>

      <div
        style={{
          position: "fixed",
          top: 84,
          left: 16,
          zIndex: 65,
          padding: "10px 14px",
          borderRadius: 14,
          background: "rgba(0, 0, 0, 0.45)",
          color: "#fff",
          fontSize: 12,
          lineHeight: 1.6,
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div>数据库照片：{result.length}</div>
        <div>勾选 3D：{selectedCount}</div>
        <div>实际渲染：{photos.length}</div>
      </div>

      <StarPhotoWall photos={photos} />
    </main>
  );
}
