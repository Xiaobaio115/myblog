export const dynamic = "force-dynamic";

import Link from "next/link";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";
import { PhotosGalleryClient } from "./PhotosGalleryClient";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(48);
  const categories = getPhotoCategories(photos);

  return (
    <SiteFrame>
      <PoeticPageHero
        eyebrow="Memory Atlas"
        title="记忆星图"
        description="收拢日常的微光与远行的风景，让每一帧都在时间里缓缓显影。"
        background="photos"
      >
        <Link href="/photos/3d" className="pink-btn primary">
          漫游 3D 星空相册
        </Link>
      </PoeticPageHero>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>照片墙</h2>
          <p>生活片段、旅行瞬间，以及那些值得慢慢回看的画面。</p>
        </div>
        {photos.length > 0 ? (
          <PhotosGalleryClient photos={photos} categories={categories} initialView="static" />
        ) : (
          <div className="empty-state empty-state-rich">
            <div className="empty-icon">✦</div>
            <h3>相册还在慢慢积累</h3>
            <p>先去 3D 星空相册转转，或者稍后再来看看新的照片。</p>
            <div className="empty-actions">
              <Link href="/photos/3d" className="pink-btn primary">
                打开 3D 星空相册
              </Link>
              <Link href="/" className="pink-btn">
                返回首页
              </Link>
            </div>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
