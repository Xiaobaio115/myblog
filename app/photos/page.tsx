export const dynamic = "force-dynamic";

import Link from "next/link";
import { PhotoGallery } from "@/app/components/photo-gallery";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(24);
  const categories = getPhotoCategories(photos);

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">PHOTO GALLERY</p>
        <h1 className="hero-title">把生活片段放进一个可以浏览的画廊。</h1>
        <p className="hero-copy">
          优先展示已上传到相册的内容；如果还没有独立相册数据，就回退到文章封面和示例内容。
        </p>

        <div className="hero-actions">
          <Link href="/admin/photos" className="primary-link">
            上传照片
          </Link>
          <Link href="/articles" className="secondary-link">
            查看文章
          </Link>
        </div>
      </section>

      <section className="container section">
        <PhotoGallery photos={photos} categories={categories} />
      </section>
    </SiteFrame>
  );
}
