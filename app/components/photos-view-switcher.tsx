/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { PhotoGallery } from "@/app/components/photo-gallery";
import type { Photo } from "@/lib/content";

type View = "3d" | "static";

interface Props {
  photos: Photo[];
  categories: string[];
}

const PREVIEW_COUNT = 5;

export function PhotosViewSwitcher({ photos, categories }: Props) {
  const [view, setView] = useState<View | null>(null);

  /* 背景图：用已上传的照片；每张卡片各取一段不重叠的图 */
  const bg3d = photos.find((p) => p.url)?.url ?? null;
  const bgStatic = photos.find((p, i) => i > 0 && p.url)?.url ?? null;

  /* 选项卡下方的缩略预览（两种视图各展示不同照片） */
  const preview3d = photos.filter((p) => p.url).slice(0, PREVIEW_COUNT);
  const previewStatic = photos.filter((p) => p.url).slice(PREVIEW_COUNT, PREVIEW_COUNT * 2);

  const ring = photos.filter((p) => p.url || p.emoji).slice(0, 8);
  const total = ring.length || 1;

  return (
    <div>
      {/* ── 两个玻璃拟态选项卡 ── */}
      <div className="view-option-row">
        {/* 3D 旋转 */}
        <button
          className={`view-option-card ${view === "3d" ? "selected" : ""}`}
          onClick={() => setView(view === "3d" ? null : "3d")}
          aria-pressed={view === "3d"}
        >
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
            {view === "3d" && <span className="view-option-check">✓</span>}
            <span className="view-option-icon">🎠</span>
            <h3 className="view-option-title">3D 旋转展示</h3>
            <p className="view-option-desc">沉浸式木马旋转相册体验</p>
            {/* 底部缩略图预览条 */}
            {preview3d.length > 0 && (
              <div className="view-option-thumbs">
                {preview3d.map((p) => (
                  <img key={p._id} src={p.url} alt={p.caption} className="view-thumb" />
                ))}
              </div>
            )}
          </div>
        </button>

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
      {view === "3d" && (
        <div className="carousel-3d-shell" id="carousel-3d-mount">
          {/*
           * ── 3D 木马旋转占位区 ──────────────────────────────────
           * 后续将此区域替换为 Three.js / CSS3D 旋转木马代码。
           */}
          <div className="carousel-3d-scene">
            <div className="carousel-3d-ring">
              {ring.map((photo, i) => (
                <div
                  key={photo._id}
                  className="carousel-3d-item"
                  style={{ "--i": i, "--total": total } as React.CSSProperties}
                >
                  {photo.url ? (
                    <img src={photo.url} alt={photo.caption} />
                  ) : (
                    <span className="carousel-3d-emoji">{photo.emoji || "🖼"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="carousel-3d-label">
            3D 旋转木马 · {total} 张 · 后续接入 Three.js 完整效果
          </p>
        </div>
      )}

      {view === "static" && (
        <PhotoGallery photos={photos} categories={categories} />
      )}

      {view === null && (
        <p className="view-hint">↑ 选择上方视图开始浏览相册</p>
      )}
    </div>
  );
}
