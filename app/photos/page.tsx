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
          <p>照片、分类和展示视图继续来自现有照片接口，后台上传后这里自动更新。</p>
        </div>
        <PhotosGalleryClient photos={photos} categories={categories} initialView={initialView} />
      </section>
    </SiteFrame>
  );
}
