/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { SiteFrame } from "@/app/components/site-frame";
import { profile } from "@/data/profile";
import { getLatestPhotos, getPublishedPosts } from "@/lib/content";

export default async function HomePage() {
  const posts = await getPublishedPosts(100);
  const photos = await getLatestPhotos(48);
  const latestPosts = posts.slice(0, 4);
  const featuredPhotos = photos.slice(0, 8);

  const stats = [
    { label: "文章", value: posts.length },
    { label: "照片", value: photos.length },
    { label: "标签", value: 5 },
  ];

  return (
    <SiteFrame>
      <section className="home-hero-v2 container">
        <div className="home-hero-left">
          <h1 className="home-hi-title">
            Hi, 我是 LQPP <span className="wave-emoji">👋</span>
          </h1>
          <p className="home-hi-sub">记录生活 · 分享技术 · 探索世界</p>
          <p className="home-hi-desc">
            热爱探索与设计，喜欢探索新技术，享受创造的过程。
            这里记录我的一切有趣的东西。
            希望通过这小小的地方，记录生活、分享见知、让更多志趣相投的朋友相遇。
          </p>
          <div className="hero-actions left">
            <Link href="/world" className="primary-link">探索我的世界</Link>
            <Link href="/articles" className="secondary-link">查看文章</Link>
          </div>
        </div>

        <aside className="home-profile-card">
          <div className="home-profile-avatar">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt={profile.name} />
              : <span>LQPP</span>}
          </div>
          <strong className="home-profile-name">{profile.name}</strong>
          <span className="home-profile-tagline">Stay hungry, stay foolish.</span>
          <div className="home-profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="home-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="home-profile-meta">
            <span>📍 {profile.location}</span>
            <span>✉️ {profile.email}</span>
            <span>🐙 GitHub</span>
          </div>
          <Link href="/about" className="profile-card-link">查看完整档案 →</Link>
        </aside>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">最新文章</h2>
            <p className="section-copy">技术笔记、生活随笔和突然出现的想法。</p>
          </div>
          <Link href="/articles" className="section-link">查看全部 →</Link>
        </div>
        {latestPosts.length > 0 ? (
          <div className="cards-grid">
            {latestPosts.map((post) => <ArticleCard key={post._id} post={post} />)}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>还没有发布文章，去后台发布第一篇吧。</p>
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">精选相册</h2>
            <p className="section-copy">把生活片段放进一个可以浏览的星空里。</p>
          </div>
          <Link href="/photos" className="section-link">查看全部 →</Link>
        </div>
        {featuredPhotos.length > 0 ? (
          <div className="home-photo-grid">
            {featuredPhotos.map((photo) => (
              <Link key={photo._id} href="/photos" className="home-photo-item">
                <img src={photo.url} alt={photo.caption} loading="lazy" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-photo-placeholder">
            <Link href="/photos/3d" className="primary-link">打开 3D 星空相册</Link>
            <Link href="/photos" className="secondary-link">查看全部照片</Link>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
