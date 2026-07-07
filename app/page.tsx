/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPublishedPosts } from "@/lib/content";
import { getProfileSetting } from "@/lib/settings";

export default async function HomePage() {
  const [posts, photos, profile] = await Promise.all([
    getPublishedPosts(100),
    getLatestPhotos(48),
    getProfileSetting(),
  ]);

  const latestPosts = posts.slice(0, 4);
  const featuredPhotos = photos.slice(0, 8);
  const displayName = profile.name || "LQPP";

  const stats = [
    { label: "文章", value: posts.length },
    { label: "照片", value: photos.length },
    { label: "主题", value: 5 },
  ];

  return (
    <SiteFrame>
      <section className="pink-home-hero container">
        <div className="pink-home-copy">
          <p className="eyebrow">Personal Digital Garden</p>
          <h1>Hi，我是 {displayName}</h1>
          <p className="pink-home-status">{profile.status}</p>
          <p className="pink-home-intro">{profile.intro}</p>
          <div className="pink-home-actions">
            <Link href="/world" className="pink-btn primary">
              探索我的世界
            </Link>
            <Link href="/articles" className="pink-btn">
              查看文章
            </Link>
            <Link href="/photos/3d" className="pink-btn">
              进入星空相册
            </Link>
          </div>
        </div>

        <aside className="pink-profile-card">
          <div className="pink-profile-avatar">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={displayName} /> : <span>LQ</span>}
          </div>
          <h2>{displayName}</h2>
          <p>{profile.tagline}</p>
          <div className="pink-profile-stats">
            {stats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="pink-profile-meta">
            {profile.location && <span>{profile.location}</span>}
            {profile.email && <span>{profile.email}</span>}
            {profile.githubUrl && (
              <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            )}
          </div>
          <Link href="/about" className="pink-profile-link">
            查看完整档案
          </Link>
        </aside>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>保留现有内容模块，再统一成粉色高级前台。</h2>
          <p>文章、旅行地图、相册和 3D 星空墙都继续读取你现在的数据，只调整展示层。</p>
        </div>

        <div className="pink-module-grid">
          <article className="pink-module pink-module-wide">
            <div>
              <span className="pink-module-kicker">Articles</span>
              <h3>最新文章</h3>
              <p>技术笔记、生活随笔和突然出现的想法，继续来自文章数据库。</p>
            </div>
            <Link href="/articles" className="pink-text-link">
              查看全部
            </Link>
          </article>

          <Link href="/world/travel-map" className="pink-module pink-module-dark">
            <span className="pink-module-kicker">Travel Map</span>
            <h3>我的旅行地图</h3>
            <p>3D 中国地图、城市详情、照片和路线记忆全部保留。</p>
          </Link>

          <Link href="/photos/3d" className="pink-module">
            <span className="pink-module-kicker">Star Album</span>
            <h3>3D 星空相册</h3>
            <p>访客只看照片墙和评论，上传入口仍然只给后台登录用户。</p>
          </Link>
        </div>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>最新文章</h2>
          <p>这里直接使用 `getPublishedPosts` 的数据，部署后仍然显示后台发布的文章。</p>
        </div>
        {latestPosts.length > 0 ? (
          <div className="cards-grid">
            {latestPosts.map((post) => (
              <ArticleCard key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">LQ</div>
            <p>还没有发布文章，去后台发布第一篇吧。</p>
          </div>
        )}
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>精选相册</h2>
          <p>这里直接使用 `getLatestPhotos` 的数据，后台上传后前台会自动展示。</p>
        </div>
        {featuredPhotos.length > 0 ? (
          <div className="home-photo-grid pink-photo-grid">
            {featuredPhotos.map((photo) => (
              <Link key={photo._id} href="/photos" className="home-photo-item">
                <img src={photo.url} alt={photo.caption} loading="lazy" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-photo-placeholder">
            <Link href="/photos/3d" className="pink-btn primary">
              打开 3D 星空相册
            </Link>
            <Link href="/photos" className="pink-btn">
              查看全部照片
            </Link>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
