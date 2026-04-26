/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { SiteFrame } from "@/app/components/site-frame";
import { getAllTags, getLatestPhotos, getPublishedPosts } from "@/lib/content";

export default async function HomePage() {
  const posts = await getPublishedPosts(12);
  const photos = await getLatestPhotos(8);
  const tags = getAllTags(posts).slice(0, 8);
  const featuredPost = posts[0];
  const latestPosts = (featuredPost ? posts.slice(1) : posts).slice(0, 4);

  return (
    <SiteFrame>
      {/* ── Hero ── */}
      <section className="hero container" style={{ textAlign: "center" }}>
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          欢迎来到 Luna Notes
        </div>

        <h1 className="hero-title">
          记录<span className="title-gradient">生活与思考</span>
        </h1>

        <p className="hero-copy">
          在这里记录日常灵感、生活点滴与思考感悟，让每一个瞬间都值得被珍藏。
        </p>

        <div className="hero-actions">
          <Link href="/articles" className="primary-link">
            浏览文章
          </Link>
          <Link href="/photos" className="secondary-link">
            打开相册
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="container stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap pink">📰</div>
          <div className="stat-text">
            <strong>{posts.length}</strong>
            <span>篇文章</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap purple">🖼️</div>
          <div className="stat-text">
            <strong>{photos.length}</strong>
            <span>张图片</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap amber">🏷️</div>
          <div className="stat-text">
            <strong>{tags.length}</strong>
            <span>个标签</span>
          </div>
        </div>
      </section>

      {/* ── Featured Article ── */}
      {featuredPost ? (
        <section className="container section">
          <div className="featured-row">
            <Link href={`/posts/${featuredPost.slug}`} className="featured-media">
              {featuredPost.coverUrl ? (
                <img
                  src={featuredPost.coverUrl}
                  alt={featuredPost.title}
                  className="featured-img"
                />
              ) : (
                <div className="featured-fallback">✦</div>
              )}
              <span className="featured-badge">最新文章</span>
            </Link>

            <div className="featured-content">
              <div className="tag-list">
                {(featuredPost.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="card-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="featured-title">{featuredPost.title}</h2>
              <p className="featured-excerpt">
                {featuredPost.excerpt || "这是目前最新的一篇文章，点击进入阅读。"}
              </p>
              <div className="featured-meta">
                <span>Luna</span>
                <span>{featuredPost.date || "最近"}</span>
                {featuredPost.views ? <span>浏览 {featuredPost.views}</span> : null}
              </div>
              <div>
                <Link href={`/posts/${featuredPost.slug}`} className="primary-link">
                  阅读全文 →
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Latest Articles ── */}
      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">最新文章</h2>
            <p className="section-copy">最近更新的文章，记录我的想法与见闻。</p>
          </div>
          <Link href="/articles" className="section-link">
            查看全部
          </Link>
        </div>

        {latestPosts.length > 0 ? (
          <div className="cards-grid">
            {latestPosts.map((post) => (
              <ArticleCard key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>还没有发布文章，去后台发布第一篇吧。</p>
          </div>
        )}
      </section>

      {/* ── Photos Album ── */}
      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">精选相册</h2>
            <p className="section-copy">精选的日常照片、旅行瞬间与喜欢的画面。</p>
          </div>
          <Link href="/photos" className="section-link">
            查看全部
          </Link>
        </div>

        {photos.length > 0 ? (
          <div className="album-grid">
            {photos.slice(0, 4).map((photo) => (
              <Link key={photo._id} href="/photos" className="album-card">
                {photo.url ? (
                  <img src={photo.url} alt={photo.caption} className="album-img" />
                ) : (
                  <div className="album-fallback">{photo.emoji || "📷"}</div>
                )}
                <div className="album-overlay">
                  <strong className="album-caption">{photo.caption}</strong>
                  {photo.date ? <span className="album-date">{photo.date}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📷</div>
            <p>还没有上传照片，去后台上传第一张吧。</p>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
