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
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} 小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} 天前`;
    return d.toLocaleDateString("zh-CN");
  } catch {
    return "";
  }
}

export default function CommentsPanel({ photoId }: { photoId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // restore saved author name
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(AUTHOR_KEY) : null;
    if (saved) setAuthor(saved);
  }, []);

  // load comments when photoId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/photos/${photoId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments || []);
      })
      .catch(() => {
        if (!cancelled) setError("加载评论失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photoId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim(), content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
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
    <aside className={styles.commentsPanel} onClick={(e) => e.stopPropagation()}>
      <div className={styles.commentsTitle}>
        <span>评论</span>
        <small>{comments.length}</small>
      </div>

      <div className={styles.commentList}>
        {loading ? (
          <div className={styles.commentEmpty}>加载中…</div>
        ) : comments.length === 0 ? (
          <div className={styles.commentEmpty}>还没有评论，留下第一条吧</div>
        ) : (
          comments.map((c) => (
            <article key={c._id} className={styles.commentItem}>
              <header>
                <strong>{c.author}</strong>
                <time>{formatTime(c.createdAt)}</time>
              </header>
              <p>{c.content}</p>
            </article>
          ))
        )}
      </div>

      <form className={styles.commentForm} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="昵称（可留空）"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={40}
        />
        <textarea
          placeholder="写下你的评论…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          required
        />
        {error && <div className={styles.commentError}>{error}</div>}
        <button type="submit" disabled={submitting || !content.trim()}>
          {submitting ? "发送中…" : "发送评论"}
        </button>
      </form>
    </aside>
  );
}
