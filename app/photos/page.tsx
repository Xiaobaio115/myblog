export const dynamic = "force-dynamic";

import Link from "next/link";
import { PhotoGallery } from "@/app/components/photo-gallery";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(24);
  const categories = getPhotoCategories(photos);

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

        <h1 className="hero-title">把生活片段放进一个可以浏览的画廊。</h1>

        <p className="hero-subtitle">
          优先展示你上传到相册的照片；如果还没有独立相册数据，就回退到文章封面和示例内容。
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

      <section className="container section">
        <PhotoGallery photos={photos} categories={categories} />
      </section>
    </main>
  );
}
