import Link from "next/link";
import {
  filterPosts,
  getAllTags,
  getLatestPostVisitsBySlugs,
  getPublishedPosts,
  getUniqueVisitorCountsBySlugs,
} from "@/lib/content";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{
    created?: string | string[];
    q?: string | string[];
    tag?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function formatVisitTime(value?: Date | string) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function AdminPostsPage({
  searchParams,
}: AdminPostsPageProps) {
  const params = await searchParams;
  const createdSlug = pickFirst(params.created).trim();
  const query = pickFirst(params.q).trim();
  const selectedTag = pickFirst(params.tag).trim();

  const posts = await getPublishedPosts(100);
  const tags = getAllTags(posts);
  const filteredPosts = filterPosts(posts, query, selectedTag);
  const postSlugs = filteredPosts.map((post) => post.slug);
  const [latestVisits, uniqueVisitorCounts] = await Promise.all([
    getLatestPostVisitsBySlugs(postSlugs),
    getUniqueVisitorCountsBySlugs(postSlugs),
  ]);

  const makeFilterHref = (tag: string) => {
    const urlParams = new URLSearchParams();

    if (tag) {
      urlParams.set("tag", tag);
    }

    if (query) {
      urlParams.set("q", query);
    }

    const search = urlParams.toString();
    return search ? `/admin/posts?${search}` : "/admin/posts";
  };

  const resultTitle = query ? `“${query}” 的搜索结果` : selectedTag || "全部文章";

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <div className="admin-kicker">Posts</div>
            <h1 className="section-title">管理文章</h1>
            <p className="section-copy">
              这里会列出已发布文章，你可以继续筛选、编辑，并直接查看最近访问来源和累计 UV。
            </p>
          </div>

          <Link href="/admin/posts/new" className="primary-link">
            新建文章
          </Link>
        </div>

        <div className="filter-panel">
          <form action="/admin/posts" method="get" className="search-form">
            {selectedTag ? (
              <input type="hidden" name="tag" value={selectedTag} />
            ) : null}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="搜索标题、摘要、正文或标签"
              className="search-input"
            />
            <button type="submit" className="search-button">
              搜索
            </button>
          </form>

          <div className="tag-row">
            <Link
              href={query ? `/admin/posts?q=${encodeURIComponent(query)}` : "/admin/posts"}
              className={`tag-chip ${selectedTag ? "" : "selected"}`}
            >
              全部
            </Link>
            {tags.map((tag) => (
              <Link
                key={tag}
                href={makeFilterHref(tag)}
                className={`tag-chip ${selectedTag === tag ? "selected" : ""}`}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>

        {createdSlug ? (
          <div className="status-banner">
            文章已发布。
            <Link href={`/posts/${createdSlug}`} className="inline-link">
              立即查看
            </Link>
          </div>
        ) : null}

        <div className="section-head">
          <div>
            <h2 className="section-title">{resultTitle}</h2>
            <p className="section-copy">共找到 {filteredPosts.length} 篇内容。</p>
          </div>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="post-manage-list">
            {filteredPosts.map((post) => {
              const latestVisit = latestVisits[post.slug];
              const uniqueVisitors = uniqueVisitorCounts[post.slug] || 0;

              return (
                <article key={post._id} className="post-manage-item">
                  <div className="post-manage-main">
                    <h2>{post.title}</h2>
                    <p>{post.excerpt || "这篇文章暂时还没有摘要。"}</p>

                    <div className="post-manage-meta">
                      <span>Slug: {post.slug}</span>
                      <span>{post.date || "刚刚发布"}</span>
                      <span>浏览 {post.views || 0}</span>
                      <span>UV {uniqueVisitors}</span>
                    </div>

                    <div className="post-visit-summary">
                      {latestVisit ? (
                        <>
                          <span className="post-visit-chip">
                            机型 {latestVisit.device || "Unknown device"}
                          </span>
                          <span className="post-visit-chip">
                            IP {latestVisit.ip || "unknown"}
                          </span>
                          <span className="post-visit-chip">
                            {latestVisit.platform || "Unknown platform"} /{" "}
                            {latestVisit.browser || "Unknown browser"}
                          </span>
                          <span className="post-visit-time">
                            最近访问 {formatVisitTime(latestVisit.createdAt)}
                          </span>
                        </>
                      ) : (
                        <span className="post-visit-empty">还没有访问记录</span>
                      )}
                    </div>
                  </div>

                  <div className="post-manage-actions">
                    <Link href={`/admin/posts/${post.slug}`} className="secondary-link">
                      编辑
                    </Link>
                    <Link href={`/posts/${post.slug}`} className="secondary-link">
                      查看文章
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">搜</div>
            <p>没有找到符合条件的文章，换个关键词或标签试试。</p>
          </div>
        )}
      </div>
    </main>
  );
}
