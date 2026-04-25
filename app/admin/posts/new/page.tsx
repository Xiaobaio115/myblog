"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CoverImageField } from "@/app/admin/posts/cover-image-field";
import { MarkdownEditor } from "@/app/admin/posts/markdown-editor";
import {
  buildSlug,
  clearDraft,
  loadDraft,
  saveDraft,
  type PostFormShape,
} from "@/app/admin/posts/post-form-utils";

const DRAFT_KEY = "admin_post_draft_new";

const initialForm: PostFormShape = {
  title: "",
  slug: "",
  excerpt: "",
  tags: "",
  coverUrl: "",
  content: "",
};

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

export default function AdminNewPostPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<PostFormShape>(() =>
    loadDraft(DRAFT_KEY, initialForm)
  );

  useEffect(() => {
    saveDraft(DRAFT_KEY, form);
  }, [form]);

  function updateTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: slugTouched ? current.slug : buildSlug(title),
    }));
  }

  function regenerateSlug() {
    setForm((current) => ({
      ...current,
      slug: buildSlug(current.title),
    }));
    setSlugTouched(true);
  }

  function resetDraft() {
    clearDraft(DRAFT_KEY);
    setSlugTouched(false);
    setForm(initialForm);
    setStatus("本地草稿已清空。");
  }

  async function submitPost() {
    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setStatus("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    setSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: form.excerpt.trim(),
          content: form.content.trim(),
          coverUrl: form.coverUrl.trim(),
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          published: true,
        }),
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "发布文章失败。"
        );
      }

      clearDraft(DRAFT_KEY);
      router.push(`/admin/posts?created=${encodeURIComponent(form.slug.trim())}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布文章失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <div className="admin-kicker">Create</div>
            <h1 className="section-title">发布文章</h1>
            <p className="section-copy">
              文章会写入 MongoDB 的 <code>posts</code> 集合，并立即出现在前台文章列表中。
            </p>
          </div>

          <Link href="/admin/posts" className="secondary-link">
            返回管理
          </Link>
        </div>

        <div className="draft-row">
          <div className="draft-chip">草稿会自动保存在当前浏览器</div>
          <button
            type="button"
            className="secondary-link draft-action"
            onClick={resetDraft}
          >
            清空草稿
          </button>
        </div>

        {status ? <div className="status-banner">{status}</div> : null}

        <div className="post-form-grid">
          <input
            className="admin-input"
            placeholder="文章标题"
            value={form.title}
            onChange={(event) => updateTitle(event.target.value)}
          />

          <div className="slug-field">
            <input
              className="admin-input"
              placeholder="Slug，例如 my-first-post"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm({ ...form, slug: event.target.value });
              }}
            />
            <button
              type="button"
              className="secondary-link slug-button"
              onClick={regenerateSlug}
            >
              重新生成
            </button>
          </div>

          <input
            className="admin-input"
            placeholder="文章摘要"
            value={form.excerpt}
            onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
          />

          <input
            className="admin-input"
            placeholder="标签，用英文逗号分隔"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
          />

          <CoverImageField
            value={form.coverUrl}
            onChange={(coverUrl) => setForm({ ...form, coverUrl })}
            disabled={submitting}
          />
        </div>

        <MarkdownEditor
          value={form.content}
          onChange={(content) => setForm({ ...form, content })}
          disabled={submitting}
        />

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button"
            onClick={submitPost}
            disabled={submitting}
          >
            {submitting ? "发布中…" : "发布文章"}
          </button>
        </div>
      </div>
    </main>
  );
}
