"use client";

import { PhotosViewSwitcher } from "@/app/components/photos-view-switcher";
import type { Photo } from "@/lib/content";

type Props = {
  photos: Photo[];
  categories: string[];
};

export function PhotosGalleryClient({ photos, categories }: Props) {
  return <PhotosViewSwitcher photos={photos} categories={categories} />;
}
