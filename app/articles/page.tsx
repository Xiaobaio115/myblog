export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { SiteFrame } from "@/app/components/site-frame";
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

    if (tag) {
      urlParams.set("tag", tag);
    }

    if (query) {
      urlParams.set("q", query);
    }

    const search = urlParams.toString();
    return search ? `/articles?${search}` : "/articles";
  };

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">Thinking Fragments</p>
        <h1 className="hero-title">思考碎片</h1>
        <p className="hero-copy">
          这里放着我的技术笔记、生活随笔、旅行记录和一些突然出现的想法。
        </p>
      </section>

      <section className="container section article-shell">
        <aside className="article-sidebar">
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

        <div className="article-main">
          <div className="filter-panel">
            <form action="/articles" method="get" className="search-form">
              {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="搜索标题、摘要或标签"
                className="search-input"
              />
              <button type="submit" className="search-button">
                搜索
              </button>
            </form>
          </div>

          <div className="section-head">
            <div>
              <h2 className="section-title">
                {query ? `“${query}” 的搜索结果` : selectedTag || "全部文章"}
              </h2>
              <p className="section-copy">共找到 {filteredPosts.length} 篇内容。</p>
            </div>
          </div>

          {filteredPosts.length > 0 ? (
            <div className="article-list-stack">
              {filteredPosts.map((post) => (
                <ArticleCard key={post._id} post={post} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔎</div>
              <p>没有找到符合条件的文章，你可以换个关键词或者回到全部文章。</p>
            </div>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
