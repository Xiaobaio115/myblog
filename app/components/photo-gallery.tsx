"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import type { Photo } from "@/lib/content";

interface Props {
  photos: Photo[];
  categories: string[];
}

export function PhotoGallery({ photos, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [visible, setVisible] = useState(true);
  const [displayed, setDisplayed] = useState<Photo[]>(photos);

  function changeCategory(cat: string) {
    if (cat === activeCategory) return;
    setVisible(false);
    setTimeout(() => {
      setActiveCategory(cat);
      setDisplayed(cat === "全部" ? photos : photos.filter((p) => p.category === cat));
      setVisible(true);
    }, 220);
  }

  useEffect(() => {
    setDisplayed(
      activeCategory === "全部" ? photos : photos.filter((p) => p.category === activeCategory)
    );
  }, [photos, activeCategory]);

  return (
    <div>
      {categories.length > 0 && (
        <div className="category-tabs">
          <button
            className={`category-tab${activeCategory === "全部" ? " active" : ""}`}
            onClick={() => changeCategory("全部")}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-tab${activeCategory === cat ? " active" : ""}`}
              onClick={() => changeCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className={`photo-masonry${visible ? " gallery-visible" : " gallery-hidden"}`}>
        {displayed.map((photo, index) => (
          <div
            key={photo._id}
            className="gallery-item"
            style={{ animationDelay: `${Math.min(index * 0.04, 0.6)}s` }}
          >
            <div className="photo-card">
              {photo.url ? (
                <img src={photo.url} alt={photo.caption} className="photo-media" />
              ) : photo.emoji ? (
                <div className="photo-fallback">{photo.emoji}</div>
              ) : (
                <div className="photo-fallback">📷</div>
              )}
              <div className="photo-overlay">
                {photo.category && (
                  <span className="photo-cat-badge">{photo.category}</span>
                )}
                <p className="photo-caption">{photo.caption}</p>
                <p className="photo-date">{photo.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <p>该分类下还没有照片，去后台上传一张吧。</p>
        </div>
      )}
    </div>
  );
}
