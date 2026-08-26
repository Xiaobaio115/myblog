import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { ScrollReveal } from "@/app/components/scroll-reveal";
import { SafeImage } from "@/app/components/safe-image";
import { getAllSeries, getPublishedPosts, type Post } from "@/lib/content";
import { getAllSeriesMeta } from "@/lib/series-db";
import { SERIES_CATEGORIES } from "@/lib/series";
import styles from "./series-page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "系列 | LQPP World",
  description: "按篇章顺序阅读 LQPP World 的连载与专题文章。",
};

type SeriesPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

const CATEGORY_ENTRIES = Object.entries(SERIES_CATEGORIES);
const CATEGORY_COLORS: Record<string, string> = {
  travel: "#f59e0b",
  tech: "#3b82f6",
  coding: "#8b5cf6",
  life: "#10b981",
};

function postHref(slug: string) {
  return `/posts/${encodeURIComponent(slug)}`;
}

function orderPosts(posts: Post[]) {
  return [...posts].sort((left, right) => {
    const leftOrder = typeof left.seriesOrder === "number" ? left.seriesOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.seriesOrder === "number" ? right.seriesOrder : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || String(left.date || "").localeCompare(String(right.date || ""));
  });
}

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const params = await searchParams;
  const selectedCategory = pickFirst(params.category).trim();

  const [posts, metas] = await Promise.all([
    getPublishedPosts(0),
    getAllSeriesMeta(),
  ]);

  const filteredPosts = posts.filter((post) => post.slug.trim());
  const names = getAllSeries(filteredPosts);
  const metaByName = new Map(metas.map((m) => [m.name, m]));

  // Build series with meta, sorted by meta.sortOrder first, then by name
  const allSeries = names
    .map((name) => {
      const meta = metaByName.get(name);
      const entries = orderPosts(filteredPosts.filter((post) => post.series?.trim() === name));
      return {
        name,
        category: meta?.category ?? null,
        description: meta?.description || "",
        cover: meta?.cover || "",
        sortOrder: meta?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        entries,
        image:
          meta?.cover ||
          entries.find((post) => post.coverUrl)?.coverUrl ||
          "/poetic-images/hero-articles.jpg",
      };
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "zh-CN");
    });

  const visibleSeries = selectedCategory
    ? allSeries.filter((s) => s.category === selectedCategory)
    : allSeries;

  return (
    <SiteFrame><div className="series-page">
      <main className={styles.page}>
        <ScrollReveal mode="stickyHero"><section className={styles.hero}>
          <Image src="/poetic-images/hero-articles.jpg" alt="桌面上的文章与阅读记录" fill priority sizes="100vw" />
          <span className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Series archive / 连载目录</span>
            <h1>把一个问题，<br />写得更深一点。</h1>
            <p>系列是文章之外的另一种阅读方式。按顺序打开每一章，看一段想法如何从起点走到更远。</p>
            <div className={styles.heroMeta}><span>{allSeries.length} 个系列</span><span>{filteredPosts.length} 篇文章</span><Link href="/articles">浏览全部文章 ↗</Link></div>
          </div>
        </section></ScrollReveal>

        <section className={styles.archive} aria-labelledby="series-list-title">
          <ScrollReveal mode="reveal"><div className={styles.archiveHeading}>
            <div><span className={styles.eyebrow}>01 / Archive</span><h2 id="series-list-title">连载与专题</h2></div>
            <p>每个系列都保留自己的节奏、顺序与入口。</p>
          </div></ScrollReveal>

          {/* Category filter tabs */}
          <ScrollReveal mode="reveal">
            <nav className={styles.categoryTabs} aria-label="系列分类">
              <Link
                href="/series"
                className={`${styles.categoryTab} ${!selectedCategory ? styles.categoryTabActive : ""}`}
              >
                全部
              </Link>
              {CATEGORY_ENTRIES.map(([key, label]) => (
                <Link
                  key={key}
                  href={`/series?category=${key}`}
                  className={`${styles.categoryTab} ${selectedCategory === key ? styles.categoryTabActive : ""}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </ScrollReveal>

          {visibleSeries.length > 0 ? (
            <div className={styles.seriesList}>
              {visibleSeries.map((item, index) => (
                <ScrollReveal mode="reveal" key={item.name}><article className={styles.seriesRow}>
                  <div className={styles.seriesIndex}>{String(index + 1).padStart(2, "0")}</div>
                  <Link href={`/articles?series=${encodeURIComponent(item.name)}`} className={styles.seriesImage}>
                    <SafeImage src={item.image} alt={item.name} fallback={item.name} className={styles.seriesImageFrame} imageClassName={styles.seriesImageElement} loading={index === 0 ? "eager" : "lazy"} />
                  </Link>
                  <div className={styles.seriesCopy}>
                    <div className={styles.seriesMeta}>
                      <span>{item.entries.length} 篇</span>
                      {item.category ? (
                        <span
                          className={styles.categoryBadge}
                          style={{ background: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.life }}
                        >
                          {SERIES_CATEGORIES[item.category]}
                        </span>
                      ) : null}
                      <span>{item.entries[0]?.date || "持续更新"}</span>
                    </div>
                    <h3><Link href={`/articles?series=${encodeURIComponent(item.name)}`}>{item.name}</Link></h3>
                    <p>{item.description || item.entries[0]?.excerpt || "从第一章开始，沿着这个主题继续阅读。"}</p>
                    <ol>{item.entries.slice(0, 3).map((post, postIndex) => <li key={post.slug}><Link href={postHref(post.slug)}><span>{String(postIndex + 1).padStart(2, "0")}</span>{post.title.trim() || "未命名文章"}</Link></li>)}</ol>
                    <Link href={`/articles?series=${encodeURIComponent(item.name)}`} className={styles.openLink}>打开系列 <span aria-hidden="true">↗</span></Link>
                  </div>
                </article></ScrollReveal>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyImage}><Image src="/poetic-images/hero-home.jpg" alt="等待被写下的系列文章" fill sizes="(max-width: 760px) 100vw, 42vw" /><span className={styles.heroShade} aria-hidden="true" /><span>Series / 00</span></div>
              <div className={styles.emptyCopy}>
                <span className={styles.eyebrow}>
                  {selectedCategory ? `「${SERIES_CATEGORIES[selectedCategory] || selectedCategory}」分类下还没有系列` : "还没有系列内容"}
                </span>
                <h3>{selectedCategory ? "换个分类看看，或者去后台创建这个分类的新系列。" : "从后台给文章填上同一个系列名称，目录会自动在这里生成。"}</h3>
                <p>{selectedCategory ? "在后台系列管理中为系列设置分类，它们就会出现在这里。" : "系列顺序使用 1、2、3 排列；文章封面会成为系列入口的视觉封面。单篇文章仍然可以留空，保持独立。"}</p>
                <Link href={selectedCategory ? "/series" : "/articles"} className={styles.openLink}>
                  {selectedCategory ? "查看全部系列" : "先浏览文章"} <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div></SiteFrame>
  );
}