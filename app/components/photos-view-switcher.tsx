/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { PhotoGallery } from "./photo-gallery";
import type { Photo } from "@/lib/content";

type View = "static";

interface Props {
  photos: Photo[];
  categories: string[];
  initialView?: View | null;
}

const PREVIEW_COUNT = 5;

export function PhotosViewSwitcher({ photos, categories, initialView = null }: Props) {
  const [view, setView] = useState<View | null>(initialView);
  const bg3d = photos.find((photo) => photo.url)?.url ?? null;
  const preview3d = photos.filter((photo) => photo.url).slice(0, PREVIEW_COUNT);

  return (
    <div>
      <Link href="/photos/3d" className="photo-hero-card">
        {bg3d ? (
          <div className="photo-hero-card-bg" style={{ backgroundImage: `url(${bg3d})` }} />
        ) : (
          <div className="photo-hero-card-bg photo-hero-card-bg--fallback" />
        )}
        <div className="photo-hero-card-overlay" />
        <div className="photo-hero-card-body">
          <div className="photo-hero-card-left">
            <span className="photo-hero-card-icon">3D</span>
            <h3 className="photo-hero-card-title">3D 星空相册</h3>
            <p className="photo-hero-card-desc">在可旋转的星空照片墙里，重新浏览每一段记忆。</p>
            <span className="photo-hero-card-cta">进入体验</span>
          </div>
          {preview3d.length > 0 && (
            <div className="photo-hero-card-thumbs">
              {preview3d.map((photo) => (
                <img key={photo._id} src={photo.url} alt={photo.caption} className="photo-hero-thumb" />
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="photo-gallery-toggle">
        <button
          className={`photo-gallery-toggle-btn${view === "static" ? " active" : ""}`}
          onClick={() => setView(view === "static" ? null : "static")}
          type="button"
        >
          {view === "static" ? "收起分类相册" : "展开分类相册"}
        </button>
      </div>

      {view === "static" && <PhotoGallery photos={photos} categories={categories} />}
    </div>
  );
}
