import Link from "next/link";
import { getAdminPosts, getAllSeries, type Post } from "@/lib/content";
import styles from "./series-admin.module.css";

export const dynamic = "force-dynamic";

function sortSeriesPosts(posts: Post[]) {
  return [...posts].sort((left, right) => {
    const leftOrder = typeof left.seriesOrder === "number" ? left.seriesOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.seriesOrder === "number" ? right.seriesOrder : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || String(left.title).localeCompare(String(right.title), "zh-CN");
  });
}

export default async function AdminSeriesPage() {
  const posts = await getAdminPosts(300);
  const names = getAllSeries(posts);
  const grouped = names.map((name) => ({ name, posts: sortSeriesPosts(posts.filter((post) => post.series?.trim() === name)) }));
  const unassigned = posts.filter((post) => !post.series?.trim());

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">SERIES</div>
          <h1>系列管理</h1>
          <p>系列由文章上的名称和顺序组成。先在这里查看结构，再从每篇文章编辑归属与篇章顺序。</p>
        </div>
        <div className={styles.headActions}><Link href="/admin/posts/new" className="admin-button">新建系列文章</Link><Link href="/series" className="secondary-link">预览系列页</Link></div>
      </div>

      <section className={styles.summary} aria-label="系列状态">
        <div><span>系列</span><strong>{grouped.length}</strong></div>
        <div><span>已归档文章</span><strong>{posts.length - unassigned.length}</strong></div>
        <div><span>待归档文章</span><strong>{unassigned.length}</strong></div>
      </section>

      {grouped.length > 0 ? (
        <div className={styles.list}>
          {grouped.map((group, index) => (
            <section key={group.name} className={styles.group}>
              <div className={styles.groupHead}><div><span className={styles.groupIndex}>{String(index + 1).padStart(2, "0")}</span><h2>{group.name}</h2></div><span>{group.posts.length} 篇</span></div>
              <ol>{group.posts.map((post, postIndex) => <li key={post._id}><span>{String(post.seriesOrder || postIndex + 1).padStart(2, "0")}</span><div><strong>{post.title}</strong><small>{post.published === false ? "未发布" : post.isPrivate ? "仅后台可见" : "前台可见"} · {post.date || "未设置日期"}</small></div><Link href={`/admin/posts/${encodeURIComponent(post.slug)}`} className="secondary-link">编辑</Link></li>)}</ol>
              <Link href={`/articles?series=${encodeURIComponent(group.name)}`} className={styles.previewLink}>打开前台系列 ↗</Link>
            </section>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <span className={styles.emptyMark}>SR / 00</span>
          <h2>还没有建立系列</h2>
          <p>在新建或编辑文章时填写相同的“系列名称”，再用“系列顺序”设置阅读先后。保存后前台 `/series` 会自动生成目录。</p>
          <Link href="/admin/posts/new" className="admin-button">开始写第一篇系列文章</Link>
        </section>
      )}

      {unassigned.length > 0 ? <section className={styles.unassigned}><h2>尚未归档的文章 <span>{unassigned.length}</span></h2><p>这些文章仍然可以独立发布；需要连载时，打开编辑并填写系列名称。</p><div>{unassigned.slice(0, 8).map((post) => <Link key={post._id} href={`/admin/posts/${encodeURIComponent(post.slug)}`}>{post.title}<span>编辑 ↗</span></Link>)}</div></section> : null}
    </main>
  );
}
