export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getDb } from "@/lib/mongodb";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const db = await getDb();

  const post = await db.collection("posts").findOne({
    slug,
    published: true,
  });

  if (!post) {
    notFound();
  }

  await db.collection("posts").updateOne(
    { slug },
    {
      $inc: { views: 1 },
      $set: { updatedAt: new Date() },
    }
  );

  const html = await marked.parse(post.content || "");

  return (
    <main className="site-shell">
      <div className="bg-orbs">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
      </div>

      <article className="article-detail">
        <Link href="/" className="back-link">
          ← 返回首页
        </Link>

        <div className="card-tags">
          {(post.tags || []).map((tag: string) => (
            <span key={tag} className="card-tag">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="article-title">{post.title}</h1>

        <div className="article-meta">
          <span>📅 {post.date || "刚刚"}</span>
          <span>👁 {(post.views || 0) + 1} 次阅读</span>
        </div>

        {post.coverUrl && (
          <img
            src={post.coverUrl}
            alt={post.title}
            className="article-cover"
          />
        )}

        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="comments-placeholder">
          <h2>💬 评论区</h2>
          <p>下一步我们会把 Twikoo 评论接回这里。</p>
        </div>
      </article>
    </main>
  );
}