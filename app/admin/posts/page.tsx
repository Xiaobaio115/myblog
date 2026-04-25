"use client";

import { useState } from "react";

export default function AdminPostsPage() {
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    tags: "",
    coverUrl: "",
    content: "",
  });

  async function submitPost() {
    const res = await fetch("/api/posts", {
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

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "发布失败");
      return;
    }

    alert("发布成功！");

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
      <div className="admin-card">
        <h1>发布文章</h1>
        <p>填写内容后会保存到 MongoDB 的 blog.posts 集合。</p>

        <input
          className="admin-input"
          type="password"
          placeholder="后台密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          className="admin-input"
          placeholder="文章标题"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <input
          className="admin-input"
          placeholder="slug，例如 my-first-post"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />

        <input
          className="admin-input"
          placeholder="摘要"
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
        />

        <input
          className="admin-input"
          placeholder="标签，用英文逗号分隔，例如 生活,旅行,技术"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />

        <input
          className="admin-input"
          placeholder="封面图 URL，可先留空"
          value={form.coverUrl}
          onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
        />

        <textarea
          className="admin-textarea"
          placeholder="正文，支持 Markdown"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />

        <button className="admin-button" onClick={submitPost}>
          发布文章 ✨
        </button>
      </div>
    </main>
  );
}
