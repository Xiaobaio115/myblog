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
      <section className="hero container">
        <p className="eyebrow">Memory Atlas</p>
        <h1 className="hero-title">记忆星图</h1>
        <p className="hero-copy">
          把生活片段放进一个可以浏览的星空里，保留普通相册和 3D 星空相册两种体验。
        </p>
        <div className="hero-actions">
          <Link href="/photos/3d" className="primary-button">
            打开 3D 星空相册
          </Link>
        </div>
      </section>

      <section className="container section">
        <PhotosGalleryClient
          photos={photos}
          categories={categories}
          initialView={initialView}
        />
      </section>
    </SiteFrame>
  );
}
