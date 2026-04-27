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
        <Link href="/photos?view=static">返回分类浏览</Link>
        <span>我的星空相册 · 3D 星空照片墙</span>
        <Link href="/admin/photos">上传照片</Link>
      </div>

      <StarPhotoWall photos={photos} />
    </main>
  );
}
