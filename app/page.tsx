export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDb } from "@/lib/mongodb";

type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverUrl?: string;
  tags?: string[];
  date?: string;
  views?: number;
  published?: boolean;
};

export default async function HomePage() {
  let posts: Post[] = [];

  try {
    const db = await getDb();

    const result = await db
      .collection("posts")
      .find({ published: true })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray();

    posts = result.map((post: any) => ({
      ...post,
      _id: post._id.toString(),
    }));
  } catch (error) {
    console.error("读取文章失败：", error);
  }

  const allTags = Array.from(
    new Set(posts.flatMap((post) => post.tags || []))
  );

  return (
    <main className="site-shell">
      <div className="bg-orbs">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
      </div>

      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">
            ✨ 我的小宇宙
          </Link>

          <div className="nav-links">
            <Link href="/" className="nav-btn active">
              🏠 首页
            </Link>
            <Link href="/photos" className="nav-btn">
              📷 相册
            </Link>
            <Link href="/admin/posts" className="nav-btn">
              ✍️ 写文章
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero container">
        <div className="hero-avatar">🌸</div>
        <h1>我的小宇宙博客</h1>
        <p>记录生活、技术、旅行和一些小小的灵感。</p>

        <div className="hero-tags">
          <span className="tag-chip selected">全部</span>
          {allTags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="section-title">📝 最新文章</div>

        {posts.length === 0 ? (
          <div className="empty-card">
            <div className="empty-icon">📭</div>
            <p>还没有文章。你可以去后台发布第一篇文章。</p>
            <Link href="/admin/posts" className="primary-link">
              去发布文章 →
            </Link>
          </div>
        ) : (
          <div className="cards-grid">
            {posts.map((post) => (
              <Link
                key={post._id}
                href={`/posts/${post.slug}`}
                className="article-card"
              >
                {post.coverUrl && (
                  <img
                    src={post.coverUrl}
                    alt={post.title}
                    className="card-cover"
                  />
                )}

                <div className="card-meta">
                  <div className="card-tags">
                    {(post.tags || []).map((tag) => (
                      <span key={tag} className="card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="card-date">
                    {post.date || "刚刚"}
                  </span>
                </div>

                <h2 className="card-title">{post.title}</h2>

                <p className="card-excerpt">
                  {post.excerpt || "暂无摘要"}
                </p>

                <div className="card-footer">
                  <span className="read-more">阅读全文 →</span>
                  <span className="card-stats">
                    👁 {post.views || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
