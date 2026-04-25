"use client";

import { useState } from "react";

export default function AdminPostsPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    tags: "",
    coverUrl: "",
    content: "",
  });

  async function submitPost() {
    setStatus("");

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        coverUrl: form.coverUrl,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        published: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "发布失败。");
      return;
    }

    setStatus("文章已发布。");

    setForm({
      title: "",
      slug: "",
      excerpt: "",
      tags: "",
      coverUrl: "",
      content: "",
    });
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <h1 className="section-title">发布文章</h1>
            <p className="section-copy">
              会写入 MongoDB 的 `posts` 集合，首页和文章页会直接读取这些数据。
            </p>
          </div>
        </div>

        {status ? <div className="status-banner">{status}</div> : null}

        <input
          className="admin-input"
          type="password"
          placeholder="后台密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <input
          className="admin-input"
          placeholder="文章标题"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />

        <input
          className="admin-input"
          placeholder="slug，例如 my-first-post"
          value={form.slug}
          onChange={(event) => setForm({ ...form, slug: event.target.value })}
        />

        <input
          className="admin-input"
          placeholder="摘要"
          value={form.excerpt}
          onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
        />

        <input
          className="admin-input"
          placeholder="标签，用英文逗号分隔"
          value={form.tags}
          onChange={(event) => setForm({ ...form, tags: event.target.value })}
        />

        <input
          className="admin-input"
          placeholder="封面图 URL"
          value={form.coverUrl}
          onChange={(event) => setForm({ ...form, coverUrl: event.target.value })}
        />

        <textarea
          className="admin-textarea"
          placeholder="正文内容，支持 Markdown"
          value={form.content}
          onChange={(event) => setForm({ ...form, content: event.target.value })}
        />

        <div className="admin-actions">
          <button className="admin-button" onClick={submitPost}>
            发布文章
          </button>
        </div>
      </div>
    </main>
  );
}
