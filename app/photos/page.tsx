export const dynamic = "force-dynamic";

import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";
import { PhotosGalleryClient } from "./PhotosGalleryClient";

type Props = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function PhotosPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const photos = await getLatestPhotos(48);
  const categories = getPhotoCategories(photos);
  const initialView = resolvedSearchParams?.view === "static" ? "static" : null;

  return (
    <SiteFrame>
      <section className="container pink-page-hero">
        <p className="eyebrow">Memory Atlas</p>
        <h1>记忆星图</h1>
        <p>把生活片段放进可以浏览的星空里，同时保留普通相册和 3D 星空相册两种体验。</p>
        <div className="pink-home-actions">
          <Link href="/photos/3d" className="pink-btn primary">
            打开 3D 星空相册
          </Link>
        </div>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>照片墙</h2>
          <p>生活片段、旅行瞬间，以及那些值得慢慢回看的画面。</p>
        </div>
        {photos.length > 0 ? (
          <PhotosGalleryClient photos={photos} categories={categories} initialView={initialView} />
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
