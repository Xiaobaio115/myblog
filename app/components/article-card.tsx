import Link from "next/link";
import type { Post } from "@/lib/content";
import { SafeImage } from "./safe-image";
import styles from "./article-card.module.css";

type ArticleCardProps = {
  post: Post;
  variant?: "feature" | "standard" | "compact";
};

export function ArticleCard({ post, variant = "standard" }: ArticleCardProps) {
  const title = post.title.trim() || "未命名文章";

  return (
    <Link href={`/posts/${encodeURIComponent(post.slug)}`} className={`${styles.card} ${styles[variant]}`}>
      <SafeImage
        src={post.coverUrl}
        alt={title}
        fallback="文字正在显影"
        className={styles.media}
        imageClassName={styles.mediaImage}
        loading={variant === "feature" ? "eager" : "lazy"}
      />

      <div className={styles.body}>
        <div className={styles.meta}>
          <div className={styles.tags}>
            {post.series ? <span className={styles.series}>{post.series}</span> : null}
            {(post.tags || []).slice(0, 2).map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
          <time>{post.date || "刚刚"}</time>
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.excerpt}>{post.excerpt || "一篇尚未写下摘要的记录。"}</p>
        <div className={styles.footer}>
          <span className={styles.read}>阅读文章 →</span>
          <span>浏览 {post.views || 0}</span>
        </div>
      </div>
    </Link>
  );
}
