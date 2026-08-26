"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoverImageField } from "@/app/admin/posts/cover-image-field";
import { MarkdownEditor } from "@/app/admin/posts/markdown-editor";
import {
  buildSlug,
  clearDraft,
  getPostFormError,
  loadDraft,
  saveDraft,
  type PostFormShape,
} from "@/app/admin/posts/post-form-utils";
import { ContentBlocksEditor } from "@/app/admin/posts/content-blocks-editor";
import type { ContentBlock } from "@/lib/content";
import type { PostVisit } from "@/lib/content";
import { adminFetch, getAdminPassword } from "@/lib/admin-api";
import styles from "../post-editor-form.module.css";

type EditablePost = {
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverUrl?: string;
  tags?: string[];
  series?: string;
  seriesOrder?: number;
  date?: string;
  views?: number;
  published?: boolean;
  isPrivate?: boolean;
  contentBlocks?: ContentBlock[];
};

type EditorProps = {
  post: EditablePost;
  recentVisits: PostVisit[];
  uniqueVisitors: number;
};

type EditorForm = PostFormShape & {
  series: string;
  seriesOrder: string;
  contentBlocks: ContentBlock[];
};

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
  const baseForm = useMemo<EditorForm>(
    () => ({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      coverUrl: post.coverUrl || "",
      tags: (post.tags || []).join(", "),
      content: post.content || "",
      series: post.series || "",
      seriesOrder:
        typeof post.seriesOrder === "number" ? String(post.seriesOrder) : "",
      contentBlocks: post.contentBlocks || [],
    }),
    [post]
  );
  const [sourceSlug, setSourceSlug] = useState(post.slug);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<EditorForm>(baseForm);
  const [published, setPublished] = useState(post.published !== false);
  const [isPrivate, setIsPrivate] = useState(Boolean(post.isPrivate));
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const draft = loadDraft(draftKey, baseForm);
    // 始终用服务端 slug，防止旧草稿静默改 slug 导致文章断链
    queueMicrotask(() => {
      setForm({ ...draft, slug: baseForm.slug });
      setDraftReady(true);
    });
  }, [baseForm, draftKey]);

  useEffect(() => {
    if (draftReady) saveDraft(draftKey, form);
  }, [draftKey, draftReady, form]);

  async function savePost() {
    const validationError = getPostFormError(form);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    const password = getAdminPassword();

    if (!password) {
      setStatus("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    // 若 slug 即将改变，弹确认对话框
    if (form.slug.trim() !== sourceSlug) {
      const ok = confirm(
        `⚠️ Slug 即将从\n「${sourceSlug}」\n改为\n「${form.slug.trim()}」\n\n已有的文章链接将失效，确认继续？`
      );
      if (!ok) return;
    }

    setSaving(true);
    setStatus("");

    try {
      const data = await adminFetch<{ slug?: string }>(`/api/posts/${encodeURIComponent(sourceSlug)}`, {
        method: "PATCH",
        password,
        json: {
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: form.excerpt.trim(),
          coverUrl: form.coverUrl.trim(),
          content: form.content.trim(),
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          series: form.series.trim(),
          seriesOrder:
            form.series.trim() && form.seriesOrder
              ? Number(form.seriesOrder)
              : null,
          published,
          isPrivate,
          contentBlocks: form.contentBlocks,
        },
        fallbackError: "保存文章失败。",
      });

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
    if (!confirm("确定删除这篇文章吗？文章和本地访问记录会一起删除。")) {
      return;
    }

    const password = getAdminPassword();

    if (!password) {
      setStatus("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    setDeleting(true);
    setStatus("");

    try {
      await adminFetch(`/api/posts/${encodeURIComponent(sourceSlug)}`, {
        method: "DELETE",
        password,
        fallbackError: "删除文章失败。",
      });

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
    setIsPrivate(Boolean(post.isPrivate));
    setStatus("本地草稿已清空。");
  }

  return (
    <div className={`admin-panel ${styles.workspace}`}>
      <div className="section-head">
        <div>
          <div className="admin-kicker">Edit</div>
          <h1 className="section-title">编辑文章</h1>
          <p className="section-copy">
            你可以修改标题、slug、摘要、封面、正文、发布状态和私密状态。
          </p>
        </div>

        <div className="post-manage-actions">
          <Link href="/admin/posts" className="secondary-link">
            返回管理
          </Link>
          {published && !isPrivate ? (
            <Link href={`/posts/${sourceSlug}`} className="secondary-link">
              查看前台
            </Link>
          ) : null}
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

      {status ? <div className="status-banner" role="status" aria-live="polite">{status}</div> : null}

      <section className={styles.formSection} aria-labelledby="edit-post-basics">
        <div className={styles.sectionHeading}>
          <h2 id="edit-post-basics">基本信息</h2>
          <p>标题、地址与摘要</p>
        </div>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.titleField}`}>
            <span>文章标题</span>
            <input className="admin-input" required placeholder="输入清晰、具体的标题" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span>文章地址</span>
            <div className={styles.slugControl}>
              <input className="admin-input" required placeholder="my-first-post" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              <button type="button" className="secondary-link" onClick={() => setForm({ ...form, slug: buildSlug(form.title) })}>根据标题生成</button>
            </div>
            {/[^\x20-\x7E]/.test(form.slug) ? <p className={styles.fieldWarning}>Slug 建议使用英文小写、数字与连字符。</p> : null}
          </label>
          <label className={styles.field}>
            <span>标签</span>
            <input className="admin-input" placeholder="技术, 随笔" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </label>
          <label className={`${styles.field} ${styles.wideField}`}>
            <span>文章摘要</span>
            <input className="admin-input" placeholder="用一两句话概括文章内容" value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} />
          </label>
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="edit-post-series">
        <div className={styles.sectionHeading}>
          <h2 id="edit-post-series">系列归档</h2>
          <p>独立文章可留空</p>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>系列名称</span>
            <input className="admin-input" placeholder="例如：从零搭建个人博客" value={form.series} onChange={(event) => setForm({ ...form, series: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span>系列顺序</span>
            <input className="admin-input" type="number" min="1" step="1" inputMode="numeric" placeholder="1" value={form.seriesOrder} onChange={(event) => setForm({ ...form, seriesOrder: event.target.value })} disabled={!form.series.trim()} />
            <p className={styles.fieldHint}>按 1、2、3 排列；未填写的篇章会排在系列末尾。</p>
          </label>
          <div className={styles.coverField}>
            <CoverImageField value={form.coverUrl} onChange={(coverUrl) => setForm({ ...form, coverUrl })} disabled={saving || deleting} />
          </div>
        </div>
        <div className={styles.stateRow}>
          <label><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span>发布到站点</span></label>
          <label><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} /><span>仅后台可见</span></label>
        </div>
      </section>

      <div className="post-manage-meta">
        <span>{post.date || "刚刚发布"}</span>
        <span>浏览 {post.views || 0}</span>
        <span>UV {uniqueVisitors}</span>
      </div>

      <details className={styles.visitorDetails}>
        <summary>访问数据 <span>{uniqueVisitors} 位独立访客 · 最近 {recentVisits.length} 次记录</span></summary>
        <div className={styles.visitorContent}>
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
        </div>
      </details>

      <section className={styles.formSection} aria-labelledby="edit-post-content">
        <div className={styles.sectionHeading}>
          <h2 id="edit-post-content">正文</h2>
          <p>支持 Markdown 与实时预览</p>
        </div>
        <MarkdownEditor value={form.content} onChange={(content) => setForm({ ...form, content })} disabled={saving || deleting} />
      </section>

      <section className={styles.formSection} aria-labelledby="edit-post-blocks">
        <ContentBlocksEditor
          blocks={form.contentBlocks}
          onChange={(contentBlocks) => setForm({ ...form, contentBlocks })}
          disabled={saving || deleting}
        />
      </section>

      <div className={styles.actionBar}>
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
