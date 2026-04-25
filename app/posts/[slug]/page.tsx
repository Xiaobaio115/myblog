/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { SiteFrame } from "@/app/components/site-frame";
import { TwikooComments } from "@/app/components/twikoo-comments";
import {
  getPublishedPost,
  incrementPostViews,
} from "@/lib/content";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  await incrementPostViews(slug);

  const html = await marked.parse(post.content || "");
  const currentViews = (post.views || 0) + 1;

  return (
    <SiteFrame>
      <article className="article-layout">
        <div className="container">
          <Link href="/articles" className="back-link">
            ← 返回文章列表
          </Link>

          <header className="article-header">
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
              <span>{currentViews} 次阅读</span>
            </div>
          </header>

          {post.coverUrl ? (
            <img src={post.coverUrl} alt={post.title} className="article-detail-cover" />
          ) : null}

          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <section className="comments-section">
            <div className="section-head">
              <div>
                <h2 className="section-title">评论区</h2>
                <p className="section-copy">和模板一样保留 Twikoo 挂载点，方便后续接入真实评论。</p>
              </div>
            </div>
            <TwikooComments envId={process.env.TWIKOO_ENV_ID} path={`/posts/${slug}`} />
          </section>
        </div>
      </article>
    </SiteFrame>
  );
}
