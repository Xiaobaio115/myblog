export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { SiteFrame } from "@/app/components/site-frame";
import {
  filterPosts,
  getAllSeries,
  getAllTags,
  getPublishedPosts,
} from "@/lib/content";
import styles from "./articles-page.module.css";

type ArticlesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
    series?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "文章 | LQPP World",
  description: "浏览 LQPP World 的技术笔记、生活随笔、旅行记录与系列文章。",
};

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams;
  const query = pickFirst(params.q).trim();
  const selectedTag = pickFirst(params.tag).trim();
  const selectedSeries = pickFirst(params.series).trim();
  const posts = (await getPublishedPosts(0)).filter((post) => post.slug.trim());
  const tags = getAllTags(posts);
  const series = getAllSeries(posts);
  const seriesItems = series.map((name) => {
    const seriesPosts = posts.filter((post) => post.series?.trim() === name);
    return {
      name,
      count: seriesPosts.length,
      latestTitle: seriesPosts[0]?.title || "系列文章",
    };
  });
  const filteredPosts = filterPosts(posts, query, selectedTag, selectedSeries);
  const orderedPosts = selectedSeries
    ? [...filteredPosts].sort((a, b) => {
        const orderA = typeof a.seriesOrder === "number" && Number.isFinite(a.seriesOrder)
          ? a.seriesOrder
          : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.seriesOrder === "number" && Number.isFinite(b.seriesOrder)
          ? b.seriesOrder
          : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      })
    : filteredPosts;
  const [lead, ...secondary] = orderedPosts;

  function filterHref(tag: string, nextSeries = selectedSeries) {
    const next = new URLSearchParams();
    if (tag) next.set("tag", tag);
    if (nextSeries) next.set("series", nextSeries);
    if (query) next.set("q", query);
    return next.size ? `/articles?${next.toString()}` : "/articles";
  }

  function seriesHref(nextSeries: string) {
    return filterHref(selectedTag, nextSeries);
  }

  const resultLabel = query
    ? `“${query}”的搜索结果`
    : selectedSeries || selectedTag || "全部文章";
  const introEyebrow = selectedSeries ? "Series reading · 系列" : "Field notes · 文章";
  const introTitle = selectedSeries || "把走过的路，写成可以回望的文字";
  const introDescription = selectedSeries
    ? `这个系列共收录 ${orderedPosts.length} 篇文章，并按照设定的篇章顺序展开。`
    : "技术笔记、生活随笔与旅行记录。这里不追逐信息流，只留下值得再次打开的篇章。";

  return (
    <SiteFrame>
      <div className={styles.layout}>
        <header className={styles.intro}>
          <div>
            {selectedSeries ? <Link href="/series" className={styles.backToSeries}>← 返回系列目录</Link> : null}
            <span className={styles.eyebrow}>{introEyebrow}</span>
            <h1>{introTitle}</h1>
          </div>
          <p>{introDescription}</p>
        </header>

        <div className={styles.tools}>
          <form action="/articles" method="get" className={styles.search}>
            {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
            {selectedSeries ? <input type="hidden" name="series" value={selectedSeries} /> : null}
            <label className={styles.srOnly} htmlFor="article-search">搜索文章</label>
            <input id="article-search" type="search" name="q" defaultValue={query} placeholder="搜索标题、摘要或标签" />
            <button type="submit">搜索</button>
          </form>
          <span className={styles.count}>{resultLabel} · {filteredPosts.length} 篇</span>
        </div>

        <nav className={styles.tags} aria-label="文章分类">
          <Link href={filterHref("")} aria-current={selectedTag ? undefined : "page"} className={`${styles.tag} ${selectedTag ? "" : styles.active}`}>全部分类</Link>
          {tags.map((tag) => (
            <Link key={tag} href={filterHref(tag)} aria-current={selectedTag === tag ? "page" : undefined} className={`${styles.tag} ${selectedTag === tag ? styles.active : ""}`}>{tag}</Link>
          ))}
        </nav>

        {seriesItems.length > 0 ? (
          <section className={styles.seriesRail} aria-label="文章系列">
            <div className={styles.seriesRailHead}>
              <div>
                <span className={styles.eyebrow}>Series</span>
                <h2>连载与专题</h2>
              </div>
              <span className={styles.seriesCount}>{seriesItems.length} 个系列</span>
            </div>
            <div className={styles.seriesList}>
              <Link href={filterHref(selectedTag, "")} aria-current={selectedSeries ? undefined : "page"} className={`${styles.seriesItem} ${selectedSeries ? "" : styles.seriesItemActive}`}>
                <span className={styles.seriesIndex}>00</span>
                <span className={styles.seriesName}>全部系列</span>
                <span className={styles.seriesMeta}>{posts.length} 篇文章</span>
              </Link>
              {seriesItems.map((item, index) => (
                <Link key={item.name} href={seriesHref(item.name)} aria-current={selectedSeries === item.name ? "page" : undefined} className={`${styles.seriesItem} ${selectedSeries === item.name ? styles.seriesItemActive : ""}`}>
                  <span className={styles.seriesIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.seriesName}>{item.name}</span>
                  <span className={styles.seriesMeta}>{item.count} 篇 · {item.latestTitle}</span>
                  <span className={styles.seriesArrow} aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.seriesEmptyRail} aria-label="系列目录">
            <div><span className={styles.eyebrow}>Series / 连载</span><h2>把几篇文章，读成一条线。</h2><p>还没有发布系列文章。后台给文章填写相同的系列名称后，这里会出现篇章目录和顺序导航。</p></div>
            <Link href="/series">打开系列目录 <span aria-hidden="true">↗</span></Link>
          </section>
        )}

        {lead ? (
          <section className={styles.editorial} aria-label={resultLabel}>
            <ArticleCard post={lead} variant="feature" />
            <div className={styles.secondary}>
              {secondary.map((post, index) => (
                <ArticleCard key={post._id} post={post} variant={index < 3 ? "compact" : "standard"} />
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.empty}>
            <span aria-hidden>✦</span>
            <h2>{query || selectedTag || selectedSeries ? "没有找到相符的文章" : "第一篇文章还在路上"}</h2>
            <p>{query || selectedTag || selectedSeries ? "换一个关键词，或回到全部文章继续翻阅。" : "不妨先去照片墙看看最近的生活切片。"}</p>
            <Link href={query || selectedTag || selectedSeries ? "/articles" : "/photos"}>{query || selectedTag || selectedSeries ? "清除筛选" : "去看照片"} →</Link>
          </section>
        )}
      </div>
    </SiteFrame>
  );
}
