import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { education, profile, skills, socials } from "@/data/profile";
import { personality } from "@/data/world";

export const metadata: Metadata = {
  title: "关于我｜LQPP Profile",
};

export default function AboutPage() {
  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">LQPP Profile</p>
        <h1 className="hero-title">我的档案</h1>
        <p className="hero-copy">一个正在用代码、文字和照片搭建自己世界的人。</p>
      </section>

      <section className="container section profile-layout">
        <aside className="profile-side-card">
          <div className="profile-avatar">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : "LQPP"}
          </div>
          <strong>{profile.name}</strong>
          <span>{profile.status}</span>
          <p>{profile.location}</p>
          <div className="profile-tag-cloud">
            {profile.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="hero-actions">
            <Link href="/guestbook" className="primary-link">联系我</Link>
            <Link href="/world" className="secondary-link">查看我的世界</Link>
          </div>
        </aside>

        <div className="profile-content-stack">
          <section className="glass-panel">
            <h2>我是谁</h2>
            <p>{profile.intro}</p>
            <p>我会把学习过程、旅行照片、家乡记忆、学校经历、游戏片段和一些突然出现的想法放在这里。希望这个网站能像一本不断更新的个人地图，记录我从哪里来、正在做什么、想去哪里。</p>
            <div className="about-highlight-grid">
              {[
                ["热爱探索", "探索未知世界和新技术"],
                ["持续学习", "保持好奇心，不断成长"],
                ["追求极致", "注重细节与体验"],
                ["分享交流", "分享经验，连接更多人"],
              ].map(([title, desc]) => (
                <div key={title} className="about-highlight-card">
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel">
            <h2>教育经历</h2>
            <div className="profile-timeline">
              {education.map((item) => (
                <div key={item.title} className="timeline-item">
                  <span className="timeline-time">{item.time}</span>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                  <div className="world-tag-row">
                    {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel">
            <h2>我的工具箱</h2>
            <div className="tech-stack-grid">
              {skills.map((group) => (
                <div key={group.group} className="tech-stack-group">
                  <strong>{group.group}</strong>
                  <div className="tech-icon-grid">
                    {group.items.map((item) => (
                      <span key={item} className="tech-icon-card">
                        <b>{item.slice(0, 2).toUpperCase()}</b>
                        <small>{item}</small>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel">
            <h2>一些关于我的关键词</h2>
            <div className="personality-grid">
              {personality.map((item) => (
                <div key={item.title} className="world-node-card">
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="contact-panel">
            <h2>找到我</h2>
            <p>如果你想交流技术、博客、游戏、旅行，或者只是想打个招呼，可以通过下面的方式找到我。</p>
            <div className="portal-grid">
              {socials.map((item) => (
                <a key={item.label} href={item.href} className="portal-card" target="_blank" rel="noopener noreferrer">
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
