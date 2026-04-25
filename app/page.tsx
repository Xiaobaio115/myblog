/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { PhotoCard } from "@/app/components/photo-card";
import { SiteFrame } from "@/app/components/site-frame";
import { getAllTags, getLatestPhotos, getPublishedPosts } from "@/lib/content";

export default async function HomePage() {
  const posts = await getPublishedPosts(12);
  const photos = await getLatestPhotos(6);
  const tags = getAllTags(posts).slice(0, 8);
  const featuredPost = posts[0];
  const latestPosts = featuredPost ? posts.slice(1, 7) : posts.slice(0, 6);
  const articleCards = latestPosts.length > 0 ? latestPosts : posts.slice(0, 6);

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">生活记录 / 文章分享 / 相册收藏</p>
        <h1 className="hero-title">欢迎来到我的博客，记录生活与思考。</h1>
        <p className="hero-copy">
          这里有我的文章、相册和日常记录。浏览文章、探索相册，一起分享生活的每一个瞬间。
        </p>

        <div className="hero-actions">
          <Link href="/articles" className="primary-link">
            浏览文章
          </Link>
          <Link href="/photos" className="secondary-link">
            打开相册
          </Link>
        </div>

        <div className="hero-stats">
          <div className="stat-pill">
            <strong>{posts.length}</strong>
            <span>篇文章</span>
          </div>
          <div className="stat-pill">
            <strong>{photos.length}</strong>
            <span>个画面</span>
          </div>
          <div className="stat-pill">
            <strong>{tags.length}</strong>
            <span>组标签</span>
          </div>
        </div>

        <div className="tag-row centered">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/articles?tag=${encodeURIComponent(tag)}`}
              className="tag-chip"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>

      {featuredPost ? (
        <section className="container section">
          <div className="spotlight">
            <div className="spotlight-copy">
              <p className="eyebrow">最新主打文章</p>
              <h2 className="spotlight-title">{featuredPost.title}</h2>
              <p className="spotlight-excerpt">
                {featuredPost.excerpt || "这是目前博客里最新的一篇内容，可以作为首页的重点入口。"}
              </p>
              <div className="tag-list">
                {(featuredPost.tags || []).map((tag) => (
                  <span key={tag} className="card-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="hero-actions">
                <Link href={`/posts/${featuredPost.slug}`} className="primary-link">
                  进入文章
                </Link>
                <Link href="/articles" className="secondary-link">
                  查看全部
                </Link>
              </div>
            </div>

            <Link href={`/posts/${featuredPost.slug}`} className="spotlight-media">
              {featuredPost.coverUrl ? (
                <img
                  src={featuredPost.coverUrl}
                  alt={featuredPost.title}
                  className="spotlight-image"
                />
              ) : (
                <div className="spotlight-fallback">
                  <span>✦</span>
                  <p>{featuredPost.date || "最近更新"}</p>
                </div>
              )}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">最新文章</h2>
            <p className="section-copy">
              最近更新的文章，记录我的想法与见闻。
            </p>
          </div>
          <Link href="/articles" className="section-link">
            查看更多
          </Link>
        </div>

        {articleCards.length > 0 ? (
          <div className="cards-grid">
            {articleCards.map((post) => (
              <ArticleCard key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>还没有发布文章。你可以去后台先写一篇内容，首页会自动更新。</p>
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">精选相册</h2>
            <p className="section-copy">
              精选的日常照片、旅行瞬间与喜欢的画面。
            </p>
          </div>
          <Link href="/photos" className="section-link">
            打开相册
          </Link>
        </div>

        <div className="photo-grid">
          {photos.map((photo) => (
            <PhotoCard key={photo._id} photo={photo} />
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
