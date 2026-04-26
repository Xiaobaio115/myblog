export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import StarPhotoWall from "./StarPhotoWall";

export default async function ThreeDPhotosPage() {
  const db = await getDb();

  const allPhotos = await db
    .collection("photos")
    .find({})
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray();

  const has3dSelected = allPhotos.some((p) => p.showIn3d);
  const result = has3dSelected ? allPhotos.filter((p) => p.showIn3d) : allPhotos;

  const photos = result.map((photo: any) => ({
    _id: photo._id.toString(),
    url: photo.url,
    caption: photo.caption || "我的照片",
    category: photo.category || "日常",
  }));

  return (
    <main className="three-d-page">
      <div className="three-d-topbar">
        <Link href="/photos" className="three-d-back">
          ← 返回相册
        </Link>

        <div className="three-d-title">3D 星空照片墙</div>

        <Link href="/admin/photos" className="three-d-admin">
          上传照片
        </Link>
      </div>

      <StarPhotoWall photos={photos} />
    </main>
  );
}