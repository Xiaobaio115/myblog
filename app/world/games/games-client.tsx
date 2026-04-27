"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { GameItem, ProfileSetting } from "@/lib/settings";

type Props = {
  games: GameItem[];
  profile: ProfileSetting;
  postCount: number;
  photoCount: number;
};

export function GamesClient({ games, profile, postCount, photoCount }: Props) {
  const [selected, setSelected] = useState(games[0] ?? null);

  if (!selected) {
    return (
      <div className="world-sub-shell container">
        <p style={{ color: "var(--text-soft)", padding: "40px 0" }}>
          暂无游戏记录，可在 <Link href="/admin/settings">后台设置</Link> 添加。
        </p>
      </div>
    );
  }

  return (
    <div className="world-sub-shell container">
      <aside className="world-sub-sidebar">
        <div className="sidebar-profile-card">
          <div className="sidebar-profile-avatar">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt={profile.name} />
              : <span>{profile.name.slice(0, 2)}</span>}
          </div>
          <strong className="sidebar-profile-name">{profile.name}</strong>
          <span className="sidebar-profile-tagline">{profile.tagline}</span>
          <div className="sidebar-profile-stats">
            <div><strong>{postCount}</strong><span>文章</span></div>
            <div><strong>{photoCount}</strong><span>照片</span></div>
          </div>
          {profile.location && <p className="sidebar-profile-location">📍 {profile.location}</p>}
          <Link href="/about" className="sidebar-profile-link">查看完整档案 →</Link>
        </div>
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            className={`world-sub-nav-item ${selected.id === game.id ? "active" : ""}`}
            onClick={() => setSelected(game)}
          >
            {game.name}
          </button>
        ))}
      </aside>

      <main className="world-sub-main">
        <div className="world-sub-detail">
          <div className="world-sub-detail-header">
            <div>
              <h1>{selected.name}</h1>
              <p className="world-sub-type">{selected.type}</p>
            </div>
            <span className="world-sub-date">{selected.date}</span>
          </div>

          <div className="world-sub-cover">
            {selected.cover
              ? <img src={selected.cover} alt={selected.name} />
              : <span className="world-sub-cover-placeholder">🎮 封面图待上传</span>}
          </div>

          <p className="world-sub-desc">{selected.desc}</p>

          <div className="world-tag-row">
            {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        </div>
      </main>
    </div>
  );
}
