/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { personality, worldLogs, worldSections as defaultWorldSections } from "@/data/world";
import { getWorldSectionsSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "我的世界｜LQPP World Map",
};

const SECTION_META: Record<string, { href: string; cta: string }> = {
  hometown: { href: "/world/hometown", cta: "进入家乡页面" },
  school:   { href: "/world/school",   cta: "进入学校页面" },
  travel:   { href: "/world/travel",   cta: "进入旅行探索" },
  games:    { href: "/world/games",    cta: "进入游戏世界" },
};

export default async function WorldPage() {
  const dbSections = await getWorldSectionsSetting();
  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">My World</p>
        <h1 className="hero-title">我的世界</h1>
        <p className="hero-copy">探索世界，记录生活，发现我的坐标。</p>
      </section>

      <section className="container section">
        <div className="world-card-grid">
          {dbSections.map((section) => {
            const meta = SECTION_META[section.id] ??
              defaultWorldSections.find((s) => s.id === section.id) ??
              { href: "/world", cta: "进入" };
            return (
              <article key={section.id} id={section.id} className="world-big-card">
                <div className="world-big-card-cover">
                  {section.cover
                    ? <img src={section.cover} alt={section.title} />
                    : <span className="world-big-card-icon">{section.icon}</span>}
                </div>
                <div className="world-big-card-body">
                  <p className="world-kicker">{section.eyebrow}</p>
                  <h2>{section.title}</h2>
                  <p>{section.desc}</p>
                  <div className="world-tag-row">
                    {section.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <Link href={meta.href} className="section-link">{meta.cta} →</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container section">
        <Link href="/world/travel-map" className="glass-panel" style={{ display: "block", textDecoration: "none", textAlign: "center", padding: "28px", transition: "transform 0.3s" }}>
          <h2 style={{ margin: "0 0 8px 0" }}>🗺️ 我的旅行地图</h2>
          <p style={{ margin: 0, opacity: 0.7 }}>3D 交互式中国旅行足迹，点击探索我走过的每一座城市 →</p>
        </Link>
      </section>

      <section id="personality" className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">我的特点</h2>
            <p className="section-copy">这些关键词一起构成了我正在扩展的个人世界。</p>
          </div>
        </div>
        <div className="personality-grid">
          {personality.map((item) => (
            <div key={item.title} className="world-node-card">
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="glass-panel">
          <h2>世界更新日志</h2>
          <div className="profile-timeline">
            {worldLogs.map((item) => (
              <div key={item} className="timeline-item">
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
