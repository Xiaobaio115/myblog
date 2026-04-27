"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { TravelItem } from "@/lib/settings";

export function TravelClient({ destinations }: { destinations: TravelItem[] }) {
  const [selected, setSelected] = useState(destinations[0] ?? null);

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
    <div className="world-sub-shell container">
      <aside className="world-sub-sidebar">
        {destinations.map((dest) => (
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
              <p>照片待上传，可在 <Link href="/admin/settings">后台设置</Link> 编辑</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
