/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { personality } from "@/data/world";
import {
  getEducationSetting,
  getProfileSetting,
  getSkillsSetting,
  getSocialsSetting,
} from "@/lib/settings";
import type { SkillItem } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "关于我 | LQPP Profile",
};

function normalizeSkill(item: SkillItem) {
  return typeof item === "string" ? { name: item, iconUrl: "" } : item;
}

export default async function AboutPage() {
  const [profile, skills, education, socials] = await Promise.all([
    getProfileSetting(),
    getSkillsSetting(),
    getEducationSetting(),
    getSocialsSetting(),
  ]);

  return (
    <SiteFrame>
      <PoeticPageHero
        eyebrow="Portrait / 关于我"
        title="关于我，和正在生长的世界"
        description="我是 LQPP，一名仍在学习和出发的创作者。这里收录我的经历、工具与正在靠近的方向。"
        background="world"
      />

      <section className="container pink-about-layout">
        <aside className="pink-about-card animate-fade-in-up">
          <div className="pink-profile-avatar float-animate">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={120}
                height={120}
                loading="eager"
                quality={90}
              />
            ) : (
              <span>LQ</span>
            )}
          </div>
          <h2>{profile.name}</h2>
          <p>{profile.status}</p>
          {profile.location && <span>{profile.location}</span>}
          <div className="pink-about-tags">
            {profile.tags?.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <Link href="/guestbook" className="pink-btn primary">
            给我留言
          </Link>
          <Link href="/world" className="pink-btn">
            查看我的世界
          </Link>
        </aside>

        <div className="pink-about-stack">
          <section className="pink-panel">
            <h2>我是谁</h2>
            <p>{profile.intro}</p>
            <p>
              我会把学习过程、旅行照片、家乡记忆、学校经历、游戏片段和突然冒出来的想法放在这里。这个网站像一张不断更新的个人地图，记录我从哪里来，正在做什么，也记录我想去哪里。
            </p>
            <div className="about-highlight-grid">
              {[
                ["热爱探索", "探索未知世界和新的技术工具"],
                ["持续学习", "保持好奇心，把学到的东西沉淀下来"],
                ["追求细节", "在交互、排版和内容表达上慢慢打磨"],
                ["分享交流", "把经历整理成可以被看见的内容"],
              ].map(([title, desc]) => (
                <div key={title} className="about-highlight-card">
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pink-panel">
            <h2>教育经历</h2>
            <div className="profile-timeline">
              {education.map((item) => (
                <div key={item.title} className="timeline-item">
                  <span className="timeline-time">{item.time}</span>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                  <div className="world-tag-row">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pink-panel">
            <h2>我的工具箱</h2>
            <div className="tech-stack-grid">
              {skills.map((group) => (
                <div key={group.group} className="tech-stack-group">
                  <strong>{group.group}</strong>
                  <div className="tech-icon-grid">
                    {group.items.map((rawItem) => {
                      const item = normalizeSkill(rawItem);
                      return (
                        <span key={item.name} className="tech-icon-card">
                          {item.iconUrl ? (
                            <img src={item.iconUrl} alt="" className="tech-icon-image" />
                          ) : (
                            <b>{item.name.slice(0, 2).toUpperCase()}</b>
                          )}
                          <small>{item.name}</small>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pink-panel">
            <h2>一些关于我的关键词</h2>
            <div className="personality-grid pink-keyword-grid">
              {personality.map((item) => (
                <div key={item.title} className="world-node-card pink-keyword-card">
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pink-panel">
            <h2>找到我</h2>
            <p>如果你想交流技术、博客、游戏、旅行，或者只是想打个招呼，可以通过下面的方式找到我。</p>
            <div className="portal-grid pink-contact-grid">
              {socials.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="portal-card pink-contact-card"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <strong>{item.label}</strong>
                  <p>{item.value}</p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </SiteFrame>
  );
}
