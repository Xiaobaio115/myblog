export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { marked } from "marked";
import { ArticleCard } from "@/app/components/article-card";
import { ScrollReveal } from "@/app/components/scroll-reveal";
import { SafeImage } from "@/app/components/safe-image";
import { SiteFrame } from "@/app/components/site-frame";
import { TwikooComments } from "@/app/components/twikoo-comments";
import { getPublishedPost, getPublishedPosts, type Post } from "@/lib/content";
import styles from "./post-detail.module.css";
import { PostReadingExperience, type TocItem } from "./post-reading-experience";
import { PostViewTracker } from "./post-view-tracker";

type PostDetailPageProps = { params: Promise<{ slug: string }> };

const getCachedPublishedPost = cache(getPublishedPost);

function decodeSlug(rawSlug: string) {
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

function postHref(slug: string) {
  return `/posts/${encodeURIComponent(slug)}`;
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const post = await getCachedPublishedPost(decodeSlug((await params).slug));

  if (!post) {
    return {
      title: "文章未找到 | LQPP World",
      description: "这篇文章不存在，或已经不再公开。",
    };
  }

  const title = post.title.trim() || "未命名文章";
  const description = post.excerpt?.trim() || "LQPP World 的一篇个人记录。";

  return {
    title: `${title} | LQPP World`,
    description: description.slice(0, 160),
    openGraph: {
      title,
      description: description.slice(0, 160),
      type: "article",
      images: post.coverUrl?.trim()
        ? [{ url: post.coverUrl.trim(), alt: title }]
        : undefined,
    },
  };
}

function prepareMarkdown(content: string) {
  const tokens = marked.lexer(content);
  const toc: TocItem[] = tokens
    .filter((token) => token.type === "heading" && token.depth >= 2 && token.depth <= 3)
    .map((token, index) => ({
      id: `section-${index + 1}`,
      text: token.type === "heading" ? token.text.replace(/<[^>]+>/g, "") : "",
      depth: token.type === "heading" ? token.depth : 2,
    }));
  const renderer = new marked.Renderer();
  let headingIndex = 0;
  renderer.heading = function heading(token) {
    const text = this.parser.parseInline(token.tokens);
    if (token.depth < 2 || token.depth > 3) return `<h${token.depth}>${text}</h${token.depth}>\n`;
    const id = toc[headingIndex]?.id || `section-${headingIndex + 1}`;
    headingIndex += 1;
    return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
  };
  return { html: marked.parse(content, { renderer }) as string, toc };
}

function getRelatedPosts(current: Post, posts: Post[]) {
  const currentTags = new Set(current.tags || []);
  return posts
    .filter((post) => post.slug.trim() && post.slug !== current.slug)
    .map((post) => ({ post, score: (post.tags || []).filter((tag) => currentTags.has(tag)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ post }) => post);
}

function getSeriesPosts(current: Post, posts: Post[]) {
  const series = current.series?.trim();

  if (!series) {
    return [];
  }

  return posts
    .filter((post) => post.slug.trim() && post.series?.trim() === series)
    .sort((a, b) => {
      const orderA =
        typeof a.seriesOrder === "number" && Number.isFinite(a.seriesOrder)
          ? a.seriesOrder
          : Number.MAX_SAFE_INTEGER;
      const orderB =
        typeof b.seriesOrder === "number" && Number.isFinite(b.seriesOrder)
          ? b.seriesOrder
          : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
}

function getReadingMinutes(content: string) {
  const plainText = content.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const chineseCharacters = plainText.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = plainText
    .replace(/[\u3400-\u9fff]/g, " ")
    .match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0;

  return Math.max(1, Math.ceil((chineseCharacters + latinWords) / 250));
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const slug = decodeSlug((await params).slug);

  const [post, posts] = await Promise.all([
    getCachedPublishedPost(slug),
    getPublishedPosts(0),
  ]);
  if (!post) notFound();

  const title = post.title.trim() || "未命名文章";
  const hasCover = Boolean(post.coverUrl?.trim());
  const content = post.content?.trim() || "";
  const { html, toc } = prepareMarkdown(content);
  const readingMinutes = getReadingMinutes(content);
  const currentIndex = posts.findIndex((item) => item.slug === post.slug);
  const newerPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const olderPost = currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;
  const seriesPosts = getSeriesPosts(post, posts);
  const seriesIndex = seriesPosts.findIndex((item) => item.slug === post.slug);
  const seriesPrevious = seriesIndex > 0 ? seriesPosts[seriesIndex - 1] : null;
  const seriesNext =
    seriesIndex >= 0 && seriesIndex < seriesPosts.length - 1
      ? seriesPosts[seriesIndex + 1]
      : null;
  const relatedPosts = getRelatedPosts(post, posts);

  return (
    <SiteFrame>
      <div className={styles.page}>
        <ScrollReveal mode={hasCover ? "heroFade" : "reveal"}>
          <header className={`${styles.header} ${hasCover ? styles.headerWithCover : ""}`}>
          {hasCover ? (
            <>
              <SafeImage
                src={post.coverUrl}
                alt=""
                fallback="封面正在显影"
                className={styles.cover}
                imageClassName={styles.coverImage}
                loading="eager"
              />
              <span className={styles.coverShade} aria-hidden="true" />
            </>
          ) : null}
          <Link href="/articles" className={styles.back}>← 全部文章</Link>
          <div className={styles.headerContent}>
            <div className={styles.kicker}>
              <span>
                {post.series?.trim() ? (
                  <Link className={styles.seriesLink} href={`/articles?series=${encodeURIComponent(post.series.trim())}`}>
                    {post.series.trim()}
                  </Link>
                ) : (
                  (post.tags || ["随笔"])[0]
                )}
              </span>
              <span>约 {readingMinutes} 分钟阅读</span>
            </div>
            <h1>{title}</h1>
            {post.excerpt ? <p className={styles.dek}>{post.excerpt}</p> : null}
            <div className={styles.meta}>
              <time>{post.date || "刚刚发布"}</time>
              <PostViewTracker slug={slug} initialViews={post.views || 0} />
            </div>
          </div>
          </header>
        </ScrollReveal>

        {seriesPosts.length > 0 ? (
          <ScrollReveal mode="reveal">
            <section className={styles.seriesContext} aria-labelledby="series-context-title">
            <div className={styles.seriesContextHead}>
              <div>
                <span className={styles.seriesEyebrow}>Series / 连载</span>
                <h2 id="series-context-title">{post.series}</h2>
              </div>
              <span className={styles.seriesProgress}>第 {seriesIndex + 1} / {seriesPosts.length} 篇</span>
            </div>
            <ol className={styles.seriesDirectory}>
              {seriesPosts.map((item, index) => {
                const itemNumber = item.seriesOrder || index + 1;
                const isCurrent = item.slug === post.slug;

                return (
                  <li key={item.slug} className={isCurrent ? styles.seriesCurrent : ""}>
                    {isCurrent ? (
                      <span className={styles.seriesDirectoryLink} aria-current="page">
                        <span className={styles.seriesNumber}>{String(itemNumber).padStart(2, "0")}</span>
                        <strong>{item.title.trim() || "未命名文章"}</strong>
                        <span className={styles.seriesState}>正在阅读</span>
                      </span>
                    ) : (
                      <Link href={postHref(item.slug)} className={styles.seriesDirectoryLink}>
                        <span className={styles.seriesNumber}>{String(itemNumber).padStart(2, "0")}</span>
                        <span>{item.title.trim() || "未命名文章"}</span>
                        <span className={styles.seriesState}>打开</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
            </section>
          </ScrollReveal>
        ) : null}

        <PostReadingExperience
          html={html || "<p>这篇文章暂时没有正文，内容仍在整理中。</p>"}
          toc={toc}
        />

        {seriesPosts.length > 1 ? (
          <ScrollReveal mode="reveal">
            <nav className={styles.seriesNav} aria-label="同系列文章导航">
            {seriesPrevious ? (
              <Link href={postHref(seriesPrevious.slug)}>
                <span>系列上一篇</span>
                <strong>{seriesPrevious.title.trim() || "未命名文章"}</strong>
              </Link>
            ) : <span />}
            {seriesNext ? (
              <Link href={postHref(seriesNext.slug)}>
                <span>系列下一篇</span>
                <strong>{seriesNext.title.trim() || "未命名文章"}</strong>
              </Link>
            ) : <span />}
            </nav>
          </ScrollReveal>
        ) : null}

        <ScrollReveal mode="reveal">
          <nav className={styles.postNav} aria-label="上一篇和下一篇">
          {newerPost ? <Link href={postHref(newerPost.slug)}><span>上一篇</span><strong>{newerPost.title.trim() || "未命名文章"}</strong></Link> : <span />}
          {olderPost ? <Link href={postHref(olderPost.slug)}><span>下一篇</span><strong>{olderPost.title.trim() || "未命名文章"}</strong></Link> : <span />}
          </nav>
        </ScrollReveal>

        {relatedPosts.length > 0 ? (
          <ScrollReveal mode="reveal">
            <section className={styles.related}>
            <div className={styles.sectionTitle}><span>Keep reading</span><h2>继续阅读</h2></div>
            <div className={styles.relatedGrid}>
              {relatedPosts.map((related) => <ArticleCard key={related._id} post={related} variant="compact" />)}
            </div>
            </section>
          </ScrollReveal>
        ) : null}

        <ScrollReveal mode="reveal">
          <section className={styles.comments}>
          <div className={styles.sectionTitle}><span>Conversation</span><h2>留下你的回声</h2></div>
          <TwikooComments envId={process.env.TWIKOO_ENV_ID} path={`/posts/${slug}`} />
          </section>
        </ScrollReveal>
      </div>
    </SiteFrame>
  );
}
