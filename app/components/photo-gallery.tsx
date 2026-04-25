"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { Photo } from "@/lib/content";

interface Props {
  photos: Photo[];
  categories: string[];
}

export function PhotoGallery({ photos, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [visible, setVisible] = useState(true);

  const displayed = useMemo(
    () =>
      activeCategory === "全部"
        ? photos
        : photos.filter((photo) => photo.category === activeCategory),
    [activeCategory, photos]
  );

  function changeCategory(category: string) {
    if (category === activeCategory) {
      return;
    }

    setVisible(false);

    window.setTimeout(() => {
      setActiveCategory(category);
      setVisible(true);
    }, 180);
  }

  return (
    <div>
      {categories.length > 0 ? (
        <div className="category-tabs">
          <button
            className={`category-tab${activeCategory === "全部" ? " active" : ""}`}
            onClick={() => changeCategory("全部")}
          >
            全部
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`category-tab${activeCategory === category ? " active" : ""}`}
              onClick={() => changeCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={`photo-gallery-grid${visible ? " gallery-visible" : " gallery-hidden"}`}
      >
        {displayed.map((photo, index) => (
          <div
            key={photo._id}
            className="gallery-item"
            style={{ animationDelay: `${Math.min(index * 0.04, 0.48)}s` }}
          >
            <div className="photo-card gallery-card">
              {photo.url ? (
                <img src={photo.url} alt={photo.caption} className="photo-media" />
              ) : photo.emoji ? (
                <div className="photo-fallback">{photo.emoji}</div>
              ) : (
                <div className="photo-fallback">📷</div>
              )}

              <div className="photo-overlay">
                {photo.category ? (
                  <span className="photo-cat-badge">{photo.category}</span>
                ) : null}
                <p className="photo-caption">{photo.caption}</p>
                <p className="photo-date">{photo.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <p>这个分类下还没有照片，去后台上传一张吧。</p>
        </div>
      ) : null}
    </div>
  );
}
