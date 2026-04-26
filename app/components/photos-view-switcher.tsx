/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { PhotoGallery } from "@/app/components/photo-gallery";
import type { Photo } from "@/lib/content";

type View = "static";

interface Props {
  photos: Photo[];
  categories: string[];
}

const PREVIEW_COUNT = 5;

export function PhotosViewSwitcher({ photos, categories }: Props) {
  const [view, setView] = useState<View | null>(null);

  /* 背景图：用已上传的照片；每张卡片各取一段不重叠的图 */
  const bg3d = photos.find((p) => p.url)?.url ?? null;
  const bgStatic = photos.find((_p: Photo, i: number) => i > 0 && _p.url)?.url ?? null;

  /* 选项卡下方的缩略预览（两种视图各展示不同照片） */
  const preview3d = photos.filter((p) => p.url).slice(0, PREVIEW_COUNT);
  const previewStatic = photos.filter((p) => p.url).slice(PREVIEW_COUNT, PREVIEW_COUNT * 2);

  return (
    <div>
      {/* ── 两个玻璃拟态选项卡 ── */}
      <div className="view-option-row">
        {/* 3D 旋转 → 跳转到 /photos/3d */}
        <Link href="/photos/3d" className="view-option-card view-option-card--link">
          {bg3d ? (
            <div
              className="view-option-bg"
              style={{ backgroundImage: `url(${bg3d})` }}
            />
          ) : (
            <div className="view-option-bg view-option-bg--gradient-3d" />
          )}
          <div className="view-option-glass" />
          <div className="view-option-body">
            <span className="view-option-badge">点击进入 →</span>
            <span className="view-option-icon">🎠</span>
            <h3 className="view-option-title">3D 星空相册</h3>
            <p className="view-option-desc">沉浸式星空旋转木马体验</p>
            {preview3d.length > 0 && (
              <div className="view-option-thumbs">
                {preview3d.map((p) => (
                  <img key={p._id} src={p.url} alt={p.caption} className="view-thumb" />
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* 静态分类 */}
        <button
          className={`view-option-card ${view === "static" ? "selected" : ""}`}
          onClick={() => setView(view === "static" ? null : "static")}
          aria-pressed={view === "static"}
        >
          {bgStatic ? (
            <div
              className="view-option-bg"
              style={{ backgroundImage: `url(${bgStatic})` }}
            />
          ) : (
            <div className="view-option-bg view-option-bg--gradient-static" />
          )}
          <div className="view-option-glass" />
          <div className="view-option-body">
            {view === "static" && <span className="view-option-check">✓</span>}
            <span className="view-option-icon">🗂</span>
            <h3 className="view-option-title">分类浏览</h3>
            <p className="view-option-desc">按分类筛选，静态画廊展示</p>
            {previewStatic.length > 0 && (
              <div className="view-option-thumbs">
                {previewStatic.map((p) => (
                  <img key={p._id} src={p.url} alt={p.caption} className="view-thumb" />
                ))}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* ── 内容区 ── */}
      {view === "static" && (
        <PhotoGallery photos={photos} categories={categories} />
      )}

      {view === null && (
        <p className="view-hint">↑ 选择上方视图开始浏览相册</p>
      )}
    </div>
  );
}
