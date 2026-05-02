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

  /* 背景图：用已上传的照片；每张卡片各取一段不重叠的图 */
  const bg3d = photos.find((p) => p.url)?.url ?? null;
  const bgStatic = photos.find((_p: Photo, i: number) => i > 0 && _p.url)?.url ?? null;

  /* 选项卡下方的缩略预览（两种视图各展示不同照片） */
  const preview3d = photos.filter((p) => p.url).slice(0, PREVIEW_COUNT);
  const previewStatic = photos.filter((p) => p.url).slice(PREVIEW_COUNT, PREVIEW_COUNT * 2);

  return (
    <div>
      {/* ── 3D 星空相册 入口卡片（全宽） ── */}
      <Link href="/photos/3d" className="photo-hero-card">
        {bg3d ? (
          <div className="photo-hero-card-bg" style={{ backgroundImage: `url(${bg3d})` }} />
        ) : (
          <div className="photo-hero-card-bg photo-hero-card-bg--fallback" />
        )}
        <div className="photo-hero-card-overlay" />
        <div className="photo-hero-card-body">
          <div className="photo-hero-card-left">
            <span className="photo-hero-card-icon">✨</span>
            <h3 className="photo-hero-card-title">3D 星空相册</h3>
            <p className="photo-hero-card-desc">沉浸式星空旋转木马，在星空中探索每一段记忆</p>
            <span className="photo-hero-card-cta">进入体验 →</span>
          </div>
          {preview3d.length > 0 && (
            <div className="photo-hero-card-thumbs">
              {preview3d.map((p) => (
                <img key={p._id} src={p.url} alt={p.caption} className="photo-hero-thumb" />
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* ── 分类画廊切换 ── */}
      <div className="photo-gallery-toggle">
        <button
          className={`photo-gallery-toggle-btn${view === "static" ? " active" : ""}`}
          onClick={() => setView(view === "static" ? null : "static")}
        >
          {view === "static" ? "收起分类画廊" : "展开分类画廊"}
        </button>
      </div>

      {view === "static" && (
        <PhotoGallery photos={photos} categories={categories} />
      )}
    </div>
  );
}
