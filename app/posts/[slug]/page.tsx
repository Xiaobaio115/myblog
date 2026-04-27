export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { SiteFrame } from "@/app/components/site-frame";
import { TwikooComments } from "@/app/components/twikoo-comments";
import { getPublishedPost } from "@/lib/content";
import { PostViewTracker } from "./post-view-tracker";

type PostDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PostDetailPage({
  params,
}: PostDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  const html = await marked.parse(post.content || "");

  const wordCount = (post.content || "").replace(/[\u4e00-\u9fa5]/g, "aa").split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 250));

  return (
    <SiteFrame>
      <section className="article-layout container">
        <header className="article-header">
          <div className="article-nav-bar">
            <Link href="/articles" className="back-link">
              ← 返回文章列表
            </Link>
            <span className="article-reading-time">约 {readingMinutes} 分钟阅读</span>
          </div>

          <div className="tag-list">
            {(post.tags || []).map((tag) => (
              <span key={tag} className="card-tag">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="article-title">{post.title}</h1>

          <div className="article-meta-bar">
            <span>{post.date || "刚刚发布"}</span>
            <PostViewTracker slug={slug} initialViews={post.views || 0} />
          </div>
        </header>

        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt={post.title}
            width={1600}
            height={960}
            sizes="(max-width: 960px) calc(100vw - 40px), 900px"
            unoptimized
            className="article-detail-cover"
          />
        ) : null}

        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <footer className="article-footer">
          <Link href="/articles" className="back-link">
            ← 返回文章列表
          </Link>
        </footer>

        <section className="comments-section">
          <TwikooComments
            envId={process.env.TWIKOO_ENV_ID}
            path={`/posts/${slug}`}
          />
        </section>
      </section>
    </SiteFrame>
  );
}
