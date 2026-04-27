/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { personality, worldLogs, worldSections } from "@/data/world";

export const metadata: Metadata = {
  title: "我的世界｜LQPP World Map",
};

export default function WorldPage() {
  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">My World</p>
        <h1 className="hero-title">我的世界</h1>
        <p className="hero-copy">探索世界，记录生活，发现我的坐标。</p>
      </section>

      <section className="container section">
        <div className="world-card-grid">
          {worldSections.map((section) => (
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
                <Link href={section.href} className="section-link">{section.cta} →</Link>
              </div>
            </article>
          ))}
        </div>
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
