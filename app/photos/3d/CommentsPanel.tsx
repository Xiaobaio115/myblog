"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./StarPhotoWall.module.css";

type Comment = {
  _id: string;
  author: string;
  content: string;
  createdAt: string;
};

const AUTHOR_KEY = "photo-comment-author";

function formatTime(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return date.toLocaleDateString("zh-CN");
  } catch {
    return "";
  }
}

export default function CommentsPanel({ photoId }: { photoId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(AUTHOR_KEY) || ""
  );
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/photos/${photoId}/comments`);
        const data = await response.json();
        if (!cancelled) setComments(data.comments || []);
      } catch {
        if (!cancelled) setError("加载评论失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [photoId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim(), content: content.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "提交失败");
        return;
      }

      setComments((prev) => [data.comment, ...prev]);
      setContent("");
      if (author.trim()) {
        localStorage.setItem(AUTHOR_KEY, author.trim());
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className={styles.commentsPanel} onClick={(event) => event.stopPropagation()}>
      <div className={styles.commentsTitle}>
        <span>评论</span>
        <small>{comments.length}</small>
      </div>

      <div className={styles.commentList}>
        {loading ? (
          <div className={styles.commentEmpty}>加载中...</div>
        ) : comments.length === 0 ? (
          <div className={styles.commentEmpty}>还没有评论，留下第一条吧。</div>
        ) : (
          comments.map((comment) => (
            <article key={comment._id} className={styles.commentItem}>
              <header>
                <strong>{comment.author}</strong>
                <time>{formatTime(comment.createdAt)}</time>
              </header>
              <p>{comment.content}</p>
            </article>
          ))
        )}
      </div>

      <form className={styles.commentForm} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="昵称（可留空）"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          maxLength={40}
        />
        <textarea
          placeholder="写下你的评论..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={500}
          required
        />
        {error && <div className={styles.commentError}>{error}</div>}
        <button type="submit" disabled={submitting || !content.trim()}>
          {submitting ? "发送中..." : "发送评论"}
        </button>
      </form>
    </aside>
  );
}
