/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { personality, worldLogs, worldSections as defaultWorldSections } from "@/data/world";
import { getWorldSectionsSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的世界 | LQPP World Map",
};

const SECTION_META: Record<
  string,
  { href: string; cta: string; tone: string; fallbackCover: string }
> = {
  hometown: {
    href: "/world/hometown",
    cta: "进入家乡页面",
    tone: "tone-home",
    fallbackCover: "/poetic-images/world-hometown.jpg",
  },
  school: {
    href: "/world/school",
    cta: "进入学校页面",
    tone: "tone-school",
    fallbackCover: "/poetic-images/world-school.jpg",
  },
  travel: {
    href: "/world/travel",
    cta: "进入旅行探索",
    tone: "tone-travel",
    fallbackCover: "/poetic-images/hero-home.jpg",
  },
};

export default async function WorldPage() {
  const dbSections = await getWorldSectionsSetting();
  const dbById = new Map(dbSections.map((section) => [section.id, section]));

  // Keep the three design-map coordinates stable even if DB settings are partial.
  const sections = defaultWorldSections.map((fallback) => {
    const saved = dbById.get(fallback.id);
    return {
      id: fallback.id,
      eyebrow: saved?.eyebrow || fallback.eyebrow,
      title: saved?.title || fallback.title,
      desc: saved?.desc || fallback.desc,
      cover: saved?.cover || fallback.cover,
      icon: saved?.icon || fallback.icon,
      tags: saved?.tags?.length ? saved.tags : fallback.tags,
      photos: saved?.photos ?? [],
      sections: saved?.sections ?? [],
    };
  });

  return (
    <SiteFrame><div className="world-page">
      <PoeticPageHero
        eyebrow="My World Map"
        title="我的世界，在山河与星光之间"
        description="从故乡的一盏灯出发，途经校园与远方，把走过的路写成自己的坐标。"
        background="world"
      >
        <a href="#hometown" className="pink-btn primary">
          从家乡出发
        </a>
        <a href="#travel" className="pink-btn">
          沿旅行寻迹
        </a>
      </PoeticPageHero>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>世界由这些坐标组成</h2>
          <p>家乡、学校、旅行和游戏，各自是独立入口，也一起拼成完整的地图。</p>
        </div>

        <div className="world-card-grid pink-world-grid">
          {sections.map((section) => {
            const meta = SECTION_META[section.id] ?? {
              href: "/world",
              cta: "进入",
              tone: "tone-default",
              fallbackCover: "/poetic-images/hero-world.jpg",
            };
            const cover = typeof section.cover === "string" ? section.cover.trim() : "";
            const visual = cover || meta.fallbackCover;

            return (
              <article
                key={section.id}
                id={section.id}
                className={`world-big-card pink-world-card ${meta.tone}`}
              >
                <div className={`world-big-card-cover ${meta.tone}`}>
                  <img src={visual} alt={section.title} loading="lazy" decoding="async" />
                </div>
                <div className="world-big-card-body">
                  <p className="world-kicker">{section.eyebrow}</p>
                  <h2>{section.title}</h2>
                  <p>{section.desc}</p>
                  {section.tags?.length ? (
                    <div className="world-tag-row">
                      {section.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <Link href={meta.href} className="pink-text-link">
                    {meta.cta}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container pink-section">
        <Link href="/world/travel-map" className="world-map-feature">
          <div className="world-map-feature__media">
            <img
              src="/poetic-images/world-travel.jpg"
              alt="山路穿过岩壁，延伸向远方"
              decoding="async"
            />
            <span className="world-map-feature__caption">3D China · Travel Atlas</span>
          </div>
          <div className="world-map-feature__copy">
            <p className="eyebrow">山河留痕 · Travel Map</p>
            <h2>把走过的路，点亮在山河之间</h2>
            <p>在可旋转的 3D 中国地图上，循着城市坐标重看照片与沿途记忆。</p>
            <span className="world-map-feature__cta">
              进入旅行地图
              <span className="world-map-feature__arrow" aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      </section>

      <section id="personality" className="container pink-section">
        <div className="pink-section-head">
          <h2>我的特点</h2>
          <p>这些关键词一起构成了我正在扩展的个人世界。</p>
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

      <section className="container pink-section">
        <div className="pink-panel">
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
    </div></SiteFrame>
  );
}
