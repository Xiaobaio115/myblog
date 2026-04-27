"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { travelDestinations } from "@/data/world";

export default function TravelPage() {
  const [selected, setSelected] = useState(travelDestinations[0]);

  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <span>旅行探索</span>
      </div>

      <div className="world-sub-shell container">
        <aside className="world-sub-sidebar">
          {travelDestinations.map((dest) => (
            <button
              key={dest.id}
              type="button"
              className={`world-sub-nav-item ${selected.id === dest.id ? "active" : ""}`}
              onClick={() => setSelected(dest)}
            >
              {dest.name}
            </button>
          ))}
          <span className="world-sub-nav-item muted">更多地方…</span>
        </aside>

        <main className="world-sub-main">
          <div className="world-sub-detail">
            <div className="world-sub-detail-header">
              <h1>{selected.name}</h1>
              <span className="world-sub-date">{selected.date}</span>
            </div>

            <div className="world-sub-cover">
              {selected.cover
                ? <img src={selected.cover} alt={selected.name} />
                : <span className="world-sub-cover-placeholder">✈️ 照片待上传</span>}
            </div>

            <p className="world-sub-desc">{selected.desc}</p>

            <div className="world-tag-row">
              {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>

            {selected.photos.length > 0 ? (
              <div className="world-sub-photo-grid">
                {selected.photos.map((url, i) => (
                  <img key={i} src={url} alt={`${selected.name} ${i + 1}`} />
                ))}
              </div>
            ) : (
              <div className="world-sub-photo-placeholder">
                <p>照片待上传，可在 <Link href="/admin/photos">后台相册</Link> 添加</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SiteFrame>
  );
}
