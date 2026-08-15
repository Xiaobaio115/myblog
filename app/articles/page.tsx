export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { ScrollAnimatedList } from "@/app/components/scroll-animated-list";
import { filterPosts, getAllTags, getPublishedPosts } from "@/lib/content";

type ArticlesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams;
  const query = pickFirst(params.q).trim();
  const selectedTag = pickFirst(params.tag).trim();

  const posts = await getPublishedPosts(100);
  const tags = getAllTags(posts);
  const filteredPosts = filterPosts(posts, query, selectedTag);

  const makeFilterHref = (tag: string) => {
    const urlParams = new URLSearchParams();

    if (tag) urlParams.set("tag", tag);
    if (query) urlParams.set("q", query);

    const search = urlParams.toString();
    return search ? `/articles?${search}` : "/articles";
  };

  return (
    <SiteFrame>
      <PoeticPageHero
        eyebrow="Field Notes / 文章"
        title={<>把走过的路，<br />写成可以回望的文字</>}
        description="技术笔记、生活随笔与旅行记录，按时间留在这里。"
        background="articles"
      />

      <section className="container pink-content-shell">
        <aside className="pink-filter-panel">
          <strong>文章分类</strong>
          <div className="article-sidebar-links">
            <Link
              href={query ? `/articles?q=${encodeURIComponent(query)}` : "/articles"}
              className={`article-sidebar-link ${selectedTag ? "" : "active"}`}
            >
              全部
            </Link>
            {tags.map((tag) => (
              <Link
                key={tag}
                href={makeFilterHref(tag)}
                className={`article-sidebar-link ${selectedTag === tag ? "active" : ""}`}
              >
                {tag}
              </Link>
            ))}
          </div>
        </aside>

        <div className="pink-content-main">
          <div className="pink-panel">
            <form action="/articles" method="get" className="search-form">
              {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="搜索标题、摘要或标签"
                className="search-input"
              />
              <button type="submit" className="pink-btn primary">
                搜索
              </button>
            </form>
          </div>

          <div className="pink-section-head compact">
            <h2>{query ? `“${query}”的搜索结果` : selectedTag || "全部文章"}</h2>
            <p>共找到 {filteredPosts.length} 篇内容。</p>
          </div>

          {filteredPosts.length > 0 ? (
            <div className="article-list-stack">
              <ScrollAnimatedList staggerDelay={80}>
                {filteredPosts.map((post) => (
                  <ArticleCard key={post._id} post={post} />
                ))}
              </ScrollAnimatedList>
            </div>
          ) : (
            <div className="empty-state empty-state-rich">
              <div className="empty-icon">✎</div>
              <h3>{query || selectedTag ? "没有匹配的文章" : "还没有发布文章"}</h3>
              <p>
                {query || selectedTag
                  ? "可以换个关键词，或者回到全部文章继续浏览。"
                  : "第一篇思考碎片很快就会出现在这里。"}
              </p>
              <div className="empty-actions">
                {query || selectedTag ? (
                  <Link href="/articles" className="pink-btn primary">
                    查看全部文章
                  </Link>
                ) : (
                  <Link href="/world" className="pink-btn primary">
                    先去看看我的世界
                  </Link>
                )}
                <Link href="/" className="pink-btn">
                  返回首页
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
