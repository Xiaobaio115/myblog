/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { Post } from "@/lib/content";

export function ArticleCard({ post }: { post: Post }) {
  return (
    <Link href={`/posts/${post.slug}`} className="article-card">
      {post.coverUrl ? (
        <img src={post.coverUrl} alt={post.title} className="article-cover" />
      ) : null}

      <div className="article-meta">
        <div className="tag-list">
          {(post.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="card-tag">
              {tag}
            </span>
          ))}
        </div>
        <span className="card-date">{post.date || "刚刚"}</span>
      </div>

      <h2 className="card-title">{post.title}</h2>
      <p className="card-excerpt">{post.excerpt || "这篇文章还没有摘要。"}</p>

      <div className="card-footer">
        <span className="read-more">阅读全文</span>
        <span className="card-stats">浏览 {post.views || 0}</span>
      </div>
    </Link>
  );
}
