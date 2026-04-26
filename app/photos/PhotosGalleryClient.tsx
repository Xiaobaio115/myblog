"use client";

import { PhotosViewSwitcher } from "@/app/components/photos-view-switcher";
import type { Photo } from "@/lib/content";

type Props = {
  photos: Photo[];
  categories: string[];
  initialView?: "static" | null;
};

export function PhotosGalleryClient({ photos, categories, initialView = null }: Props) {
  return (
    <PhotosViewSwitcher
      photos={photos}
      categories={categories}
      initialView={initialView}
    />
  );
}
