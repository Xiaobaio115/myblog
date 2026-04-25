export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import PhotosGalleryClient from "./PhotosGalleryClient";

export default async function PhotosPage() {
  const db = await getDb();

  const result = await db
    .collection("photos")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const photos = result.map((photo: any) => ({
    ...photo,
    _id: photo._id.toString(),
    createdAt: photo.createdAt?.toISOString?.() || "",
  }));

  return (
    <main className="site-shell">
      <nav className="site-topbar">
        <Link href="/" className="site-logo">
          LUNA NOTES
        </Link>

        <div className="site-nav">
          <Link href="/">首页</Link>
          <Link href="/posts">文章</Link>
          <Link href="/photos" className="active">
            相册
          </Link>
          <Link href="/admin">后台</Link>
        </div>
      </nav>

      <section className="landing-hero photo-hero">
        <div className="hero-kicker">PHOTO GALLERY</div>

        <h1 className="hero-title">
          把生活片段放进一个可以浏览的画廊。
        </h1>

        <p className="hero-subtitle">
          按分类整理照片，记录旅行、日常、风景和灵感瞬间。
          点击任意图片可以放大浏览。
        </p>

        <div className="hero-actions">
          <Link href="/admin/photos" className="primary-button">
            上传照片
          </Link>
          <Link href="/" className="secondary-button">
            返回首页
          </Link>
        </div>
      </section>

      <PhotosGalleryClient photos={photos} />
    </main>
  );
}