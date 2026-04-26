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

  const photos = result.map((photo: any) => ({
    _id: photo._id.toString(),
    url: photo.url,
    caption: photo.caption || "我的照片",
    category: photo.category || "日常",
  }));

  return (
    <main>
      <div className="three-d-page-nav">
        <Link href="/photos"> 返回相册</Link>
        <span>3D 星空照片墙</span>
        <Link href="/admin/photos">上传照片</Link>
      </div>

      <StarPhotoWall photos={photos} />
    </main>
  );
}
