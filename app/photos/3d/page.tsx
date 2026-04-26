export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import StarPhotoWall from "./StarPhotoWall";

type RawPhoto = {
  _id: { toString(): string };
  url?: unknown;
  caption?: unknown;
  category?: unknown;
  showIn3d?: unknown;
};

export default async function ThreeDPhotosPage() {
  const db = await getDb();
  const result = (await db
    .collection("photos")
    .find({ isPrivate: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray()) as RawPhoto[];

  const selectedCount = result.filter((photo) => Boolean(photo.showIn3d)).length;
  const selected =
    selectedCount > 0
      ? result.filter((photo) => Boolean(photo.showIn3d))
      : result;

  const photos = selected
    .filter((photo) => String(photo.url || "").trim())
    .map((photo) => ({
      _id: photo._id.toString(),
      url: String(photo.url),
      caption: String(photo.caption || "我的照片"),
      category: String(photo.category || "日常"),
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
