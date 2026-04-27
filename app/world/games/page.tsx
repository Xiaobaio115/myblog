"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { gamesList } from "@/data/world";

export default function GamesPage() {
  const [selected, setSelected] = useState(gamesList[0]);

  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <span>游戏世界</span>
      </div>

      <div className="world-sub-shell container">
        <aside className="world-sub-sidebar">
          {gamesList.map((game) => (
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
    </SiteFrame>
  );
}
