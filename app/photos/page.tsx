export const dynamic = "force-dynamic";

import { SiteFrame } from "@/app/components/site-frame";
import { PhotoGallery } from "@/app/components/photo-gallery";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(60);
  const categories = getPhotoCategories(photos);

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">照片画廊</p>
        <h1 className="hero-title">我的相册</h1>
        <p className="hero-copy">
          收藏一些日常照片、旅行瞬间和喜欢的画面。这里的图片会从后台上传，并保存到 Vercel Blob。
        </p>
      </section>

      <section className="container section">
        <PhotoGallery photos={photos} categories={categories} />
      </section>
    </SiteFrame>
  );
}
