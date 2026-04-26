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

export function PhotosViewSwitcher({ photos, categories }: Props) {
  const [view, setView] = useState<View>("static");
  const ring = photos.slice(0, 8);
  const total = ring.length || 1;

  return (
    <div>
      <div className="view-switcher">
        <button
          className={`view-btn ${view === "3d" ? "active" : ""}`}
          onClick={() => setView("3d")}
        >
          🎠 3D 旋转展示
        </button>
        <button
          className={`view-btn ${view === "static" ? "active" : ""}`}
          onClick={() => setView("static")}
        >
          🗂 分类浏览
        </button>
      </div>

      {view === "3d" ? (
        <div className="carousel-3d-shell" id="carousel-3d-mount">
          {/*
           * ── 3D 木马旋转占位区 ──────────────────────────────────────────
           * 后续将此区域替换为你的 Three.js / CSS3D 旋转木马代码。
           * 当前使用纯 CSS rotateY + translateZ 实现基础预览效果。
           */}
          <div className="carousel-3d-scene">
            <div className="carousel-3d-ring">
              {ring.map((photo, i) => (
                <div
                  key={photo._id}
                  className="carousel-3d-item"
                  style={
                    {
                      "--i": i,
                      "--total": total,
                    } as React.CSSProperties
                  }
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
            3D 旋转木马 · 共 {total} 张 · 后续接入完整 Three.js 效果
          </p>
        </div>
      ) : (
        <PhotoGallery photos={photos} categories={categories} />
      )}
    </div>
  );
}
