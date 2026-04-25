"use client";

import { useState } from "react";

export default function AdminPostsPage() {
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    tags: "",
    coverUrl: "",
  });

  async function submitPost() {
    const password = localStorage.getItem("admin_password") || "";

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(",").map((tag) => tag.trim()),
        published: true,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("发布成功！");
      setForm({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        tags: "",
        coverUrl: "",
      });
    } else {
      alert(data.error || "发布失败");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">发布文章</h1>

      <input
        className="mb-3 w-full rounded-xl border px-4 py-3"
        placeholder="文章标题"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />

      <input
        className="mb-3 w-full rounded-xl border px-4 py-3"
        placeholder="slug，例如 kyoto-sakura-trip"
        value={form.slug}
        onChange={(e) => setForm({ ...form, slug: e.target.value })}
      />

      <input
        className="mb-3 w-full rounded-xl border px-4 py-3"
        placeholder="摘要"
        value={form.excerpt}
        onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
      />

      <input
        className="mb-3 w-full rounded-xl border px-4 py-3"
        placeholder="标签，用英文逗号分隔，例如 生活,旅行,日本"
        value={form.tags}
        onChange={(e) => setForm({ ...form, tags: e.target.value })}
      />

      <input
        className="mb-3 w-full rounded-xl border px-4 py-3"
        placeholder="封面图 URL"
        value={form.coverUrl}
        onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
      />

      <textarea
        className="mb-3 h-80 w-full rounded-xl border px-4 py-3"
        placeholder="文章正文，支持 Markdown"
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
      />

      <button
        onClick={submitPost}
        className="rounded-xl bg-pink-500 px-6 py-3 font-bold text-white"
      >
        发布文章
      </button>
    </main>
  );
}
