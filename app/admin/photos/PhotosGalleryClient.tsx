"use client";

import { useMemo, useState } from "react";

type Photo = {
  _id: string;
  url: string;
  caption: string;
  category: string;
  createdAt?: string;
};

export default function PhotosGalleryClient({
  photos,
}: {
  photos: Photo[];
}) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const categories = useMemo(() => {
    return [
      "全部",
      ...Array.from(new Set(photos.map((photo) => photo.category).filter(Boolean))),
    ];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (activeCategory === "全部") {
      return photos;
    }

    return photos.filter((photo) => photo.category === activeCategory);
  }, [activeCategory, photos]);

  return (
    <>
      <section className="photo-category-bar">
        {categories.map((category) => (
          <button
            key={category}
            className={`photo-category ${
              activeCategory === category ? "active" : ""
            }`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </section>

      {filteredPhotos.length === 0 ? (
        <div className="empty-card">
          <div className="empty-icon">📭</div>
          <p>这个分类还没有照片。</p>
        </div>
      ) : (
        <section className="photos-grid">
          {filteredPhotos.map((photo, index) => (
            <button
              key={photo._id}
              className="photo-card"
              style={
                {
                  "--delay": `${index * 70}ms`,
                } as React.CSSProperties
              }
              onClick={() => setLightbox(photo)}
            >
              <img src={photo.url} alt={photo.caption} />

              <div className="photo-overlay">
                <strong>{photo.caption}</strong>
                <span>{photo.category}</span>
              </div>
            </button>
          ))}
        </section>
      )}

      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <button className="photo-lightbox-close">✕</button>
          <img src={lightbox.url} alt={lightbox.caption} />
          <div className="photo-lightbox-caption">
            <strong>{lightbox.caption}</strong>
            <span>{lightbox.category}</span>
          </div>
        </div>
      )}
    </>
  );
}