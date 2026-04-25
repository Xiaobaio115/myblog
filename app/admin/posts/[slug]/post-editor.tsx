"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoverImageField } from "@/app/admin/posts/cover-image-field";
import { MarkdownEditor } from "@/app/admin/posts/markdown-editor";
import {
  buildSlug,
  clearDraft,
  loadDraft,
  saveDraft,
  type PostFormShape,
} from "@/app/admin/posts/post-form-utils";
import type { PostVisit } from "@/lib/content";

type EditablePost = {
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverUrl?: string;
  tags?: string[];
  date?: string;
  views?: number;
  published?: boolean;
};

type EditorProps = {
  post: EditablePost;
  recentVisits: PostVisit[];
  uniqueVisitors: number;
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

function formatVisitTime(value?: Date | string) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function PostEditor({
  post,
  recentVisits,
  uniqueVisitors,
}: EditorProps) {
  const router = useRouter();
  const draftKey = useMemo(() => `admin_post_draft_${post.slug}`, [post.slug]);
  const baseForm = useMemo<PostFormShape>(
    () => ({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      coverUrl: post.coverUrl || "",
      tags: (post.tags || []).join(", "),
      content: post.content || "",
    }),
    [post]
  );
  const [sourceSlug, setSourceSlug] = useState(post.slug);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PostFormShape>(() =>
    loadDraft(draftKey, baseForm)
  );
  const [published, setPublished] = useState(post.published !== false);

  useEffect(() => {
    saveDraft(draftKey, form);
  }, [draftKey, form]);

  async function savePost() {
    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setStatus("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(sourceSlug)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: form.excerpt.trim(),
          coverUrl: form.coverUrl.trim(),
          content: form.content.trim(),
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          published,
        }),
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "保存文章失败。"
        );
      }

      const nextSlug =
        typeof data?.slug === "string" && data.slug.trim()
          ? data.slug.trim()
          : form.slug.trim();

      clearDraft(draftKey);
      setSourceSlug(nextSlug);
      setStatus("文章已保存。");

      if (nextSlug !== post.slug) {
        router.replace(`/admin/posts/${encodeURIComponent(nextSlug)}`);
      }

      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存文章失败。");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost() {
    if (!confirm("确定删除这篇文章吗？此操作不可恢复。")) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setStatus("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    setDeleting(true);
    setStatus("");

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(sourceSlug)}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": password,
        },
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "删除文章失败。"
        );
      }

      clearDraft(draftKey);
      router.push("/admin/posts");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除文章失败。");
    } finally {
      setDeleting(false);
    }
  }

  function resetDraft() {
    clearDraft(draftKey);
    setForm(baseForm);
    setPublished(post.published !== false);
    setStatus("本地草稿已清空。");
  }

  return (
    <div className="admin-panel">
      <div className="section-head">
        <div>
          <div className="admin-kicker">Edit</div>
          <h1 className="section-title">编辑文章</h1>
          <p className="section-copy">
            你可以修改标题、slug、摘要、封面、正文和发布状态。
          </p>
        </div>

        <div className="post-manage-actions">
          <Link href="/admin/posts" className="secondary-link">
            返回管理
          </Link>
          <Link href={`/posts/${sourceSlug}`} className="secondary-link">
            查看前台
          </Link>
        </div>
      </div>

      <div className="draft-row">
        <div className="draft-chip">当前编辑内容会自动保存为本地草稿</div>
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
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />

        <div className="slug-field">
          <input
            className="admin-input"
            placeholder="Slug，例如 my-first-post"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
          <button
            type="button"
            className="secondary-link slug-button"
            onClick={() => setForm({ ...form, slug: buildSlug(form.title) })}
          >
            根据标题生成
          </button>
        </div>

        <input
          className="admin-input"
          placeholder="文章摘要"
          value={form.excerpt}
          onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
        />

        <input
          className="admin-input post-form-span-2"
          placeholder="标签，用英文逗号分隔"
          value={form.tags}
          onChange={(event) => setForm({ ...form, tags: event.target.value })}
        />

        <CoverImageField
          value={form.coverUrl}
          onChange={(coverUrl) => setForm({ ...form, coverUrl })}
          disabled={saving || deleting}
        />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
        />
        <span>发布到前台</span>
      </label>

      <div className="post-manage-meta">
        <span>{post.date || "刚刚发布"}</span>
        <span>浏览 {post.views || 0}</span>
        <span>UV {uniqueVisitors}</span>
      </div>

      <section className="visitor-panel">
        <div className="visitor-panel-head">
          <div>
            <h2 className="section-title">最近访问</h2>
            <p className="section-copy">
              展示最近 12 次真实打开记录，当前累计独立访客为 {uniqueVisitors}。
            </p>
          </div>
        </div>

        {recentVisits.length > 0 ? (
          <div className="visitor-list">
            {recentVisits.map((visit) => (
              <article key={visit._id} className="visitor-item">
                <div className="visitor-head">
                  <div>
                    <strong className="visitor-device">
                      {visit.device || "Unknown device"}
                    </strong>
                    <p className="visitor-time">{formatVisitTime(visit.createdAt)}</p>
                  </div>
                  <span className="visitor-ip">{visit.ip || "unknown"}</span>
                </div>

                <div className="visitor-meta">
                  <span>{visit.platform || "Unknown platform"}</span>
                  <span>{visit.browser || "Unknown browser"}</span>
                  <span>{visit.slug}</span>
                </div>

                {visit.userAgent ? (
                  <p className="visitor-user-agent">{visit.userAgent}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state visitor-empty">
            <div className="empty-icon">访</div>
            <p>这篇文章暂时还没有访问记录。</p>
          </div>
        )}
      </section>

      <MarkdownEditor
        value={form.content}
        onChange={(content) => setForm({ ...form, content })}
        disabled={saving || deleting}
      />

      <div className="admin-actions">
        <button
          type="button"
          className="admin-button"
          onClick={savePost}
          disabled={saving || deleting}
        >
          {saving ? "保存中..." : "保存文章"}
        </button>
        <button
          type="button"
          className="danger-btn"
          onClick={deletePost}
          disabled={saving || deleting}
        >
          {deleting ? "删除中..." : "删除文章"}
        </button>
      </div>
    </div>
  );
}
