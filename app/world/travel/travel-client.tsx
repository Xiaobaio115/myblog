"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { ProfileSetting, TravelItem } from "@/lib/settings";

type Props = {
  destinations: TravelItem[];
  profile: ProfileSetting;
  postCount: number;
  photoCount: number;
};

export function TravelClient({ destinations, profile, postCount, photoCount }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const selected = destinations[selectedIdx] ?? null;
  const allBlocks = selected?.sections ?? [];
  const hasBlocks = allBlocks.length > 0;
  const filteredBlocks = activeTag
    ? allBlocks.filter((block) => block.tag === activeTag || block.caption.includes(activeTag))
    : allBlocks;

  if (!selected) {
    return (
      <div className="world-sub-shell container">
        <p style={{ color: "var(--text-soft)", padding: "40px 0" }}>
          暂无旅行目的地，可在 <Link href="/admin/settings">后台设置</Link> 添加。
        </p>
      </div>
    );
  }

  return (
    <>
      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <button className="photo-lightbox-close" onClick={() => setLightbox(null)} type="button">
            ×
          </button>
          <img src={lightbox} alt="大图预览" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      <div className="world-sub-shell container">
        <aside className="world-sub-sidebar">
          <div className="sidebar-profile-card">
            <div className="sidebar-profile-avatar">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} />
              ) : (
                <span>{profile.name.slice(0, 2)}</span>
              )}
            </div>
            <strong className="sidebar-profile-name">{profile.name}</strong>
            <span className="sidebar-profile-tagline">{profile.tagline}</span>
            <div className="sidebar-profile-stats">
              <div><strong>{postCount}</strong><span>文章</span></div>
              <div><strong>{photoCount}</strong><span>照片</span></div>
            </div>
            {profile.location && <p className="sidebar-profile-location">{profile.location}</p>}
            <Link href="/about" className="sidebar-profile-link">查看完整档案</Link>
          </div>

          {destinations.map((destination, index) => (
            <button
              key={destination.id || index}
              type="button"
              className={`world-sub-nav-item ${selectedIdx === index ? "active" : ""}`}
              onClick={() => {
                setSelectedIdx(index);
                setActiveTag(null);
              }}
            >
              {destination.name}
            </button>
          ))}

          <Link href="/world/travel-map" className="world-sub-nav-item world-sub-map-link">
            3D 旅行地图
          </Link>
          <span className="world-sub-nav-item muted">更多地方待记录</span>
        </aside>

        <main className="world-sub-main">
          <div className="world-sub-detail">
            <div className="world-sub-detail-header">
              <h1>{selected.name}</h1>
              <span className="world-sub-date">{selected.date}</span>
            </div>

            <div className="world-sub-cover">
              {selected.cover ? (
                <img
                  src={selected.cover}
                  alt={selected.name}
                  style={{ cursor: "zoom-in", objectPosition: selected.coverPosition ?? "center" }}
                  onClick={() => setLightbox(selected.cover)}
                />
              ) : (
                <span className="world-sub-cover-placeholder">旅行照片待上传</span>
              )}
            </div>

            <div className={`world-tag-row${hasBlocks ? " is-filter" : ""}`}>
              {selected.tags.map((tag) =>
                hasBlocks ? (
                  <button
                    key={tag}
                    type="button"
                    className={activeTag === tag ? "active" : undefined}
                    aria-pressed={activeTag === tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  >
                    {tag}
                  </button>
                ) : (
                  <span key={tag}>{tag}</span>
                ),
              )}
            </div>

            {allBlocks.length > 0 ? (
              <div className="world-content-blocks">
                {filteredBlocks.length === 0 && activeTag ? (
                  <p className="world-sub-desc" style={{ opacity: 0.6 }}>
                    暂无“{activeTag}”相关内容。
                  </p>
                ) : (
                  filteredBlocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="world-content-block">
                      {block.caption && <p className="world-sub-desc">{block.caption}</p>}
                      {block.photos.length > 0 && (
                        <div className="world-sub-photo-grid">
                          {block.photos.map((url, photoIndex) => (
                            <img
                              key={photoIndex}
                              src={url}
                              alt={`${selected.name} ${blockIndex + 1}-${photoIndex + 1}`}
                              style={{ cursor: "zoom-in" }}
                              onClick={() => setLightbox(url)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                {selected.desc && <p className="world-sub-desc">{selected.desc}</p>}
                {selected.photos.length > 0 ? (
                  <div className="world-sub-photo-grid">
                    {selected.photos.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${selected.name} ${index + 1}`}
                        style={{ cursor: "zoom-in" }}
                        onClick={() => setLightbox(url)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="world-sub-photo-placeholder">
                    <p>
                      照片待上传，可在 <Link href="/admin/settings">后台设置</Link> 添加段落。
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
