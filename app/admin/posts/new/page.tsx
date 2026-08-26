"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { adminFetch, getAdminPassword } from "@/lib/admin-api";
import styles from "../post-editor-form.module.css";

const DRAFT_KEY = "admin_post_draft_new";

type NewPostForm = PostFormShape & {
  series: string;
  seriesOrder: string;
  contentBlocks: ContentBlock[];
};

const initialForm: NewPostForm = {
  title: "",
  slug: "",
  excerpt: "",
  tags: "",
  coverUrl: "",
  content: "",
  series: "",
  seriesOrder: "",
  contentBlocks: [],
};

export default function AdminNewPostPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [form, setForm] = useState<NewPostForm>(initialForm);

  useEffect(() => {
    queueMicrotask(() => {
      setForm(loadDraft(DRAFT_KEY, initialForm));
      setDraftReady(true);
    });
  }, []);

  useEffect(() => {
    if (draftReady) saveDraft(DRAFT_KEY, form);
  }, [draftReady, form]);

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
    setIsPrivate(false);
    setForm(initialForm);
    setStatus("本地草稿已清空。");
  }

  async function submitPost() {
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

    setSubmitting(true);
    setStatus("");

    try {
      const data = await adminFetch<{ slug?: string }>("/api/posts", {
        method: "POST",
        password,
        json: {
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: form.excerpt.trim(),
          content: form.content.trim(),
          coverUrl: form.coverUrl.trim(),
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          series: form.series.trim(),
          seriesOrder:
            form.series.trim() && form.seriesOrder
              ? Number(form.seriesOrder)
              : null,
          contentBlocks: form.contentBlocks,
          published: true,
          isPrivate,
        },
        fallbackError: "发布文章失败。",
      });

      const createdSlug =
        typeof data?.slug === "string" ? data.slug : form.slug.trim();

      clearDraft(DRAFT_KEY);
      router.push(`/admin/posts?created=${encodeURIComponent(createdSlug)}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布文章失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page">
      <div className={`admin-panel ${styles.workspace}`}>
        <div className="section-head">
          <div>
            <div className="admin-kicker">Create</div>
            <h1 className="section-title">发布文章</h1>
            <p className="section-copy">
              文章会写入 MongoDB 的 `posts` 集合。你也可以将它设为仅后台可见。
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

        {status ? <div className="status-banner" role="status" aria-live="polite">{status}</div> : null}

        <section className={styles.formSection} aria-labelledby="new-post-basics">
          <div className={styles.sectionHeading}>
            <h2 id="new-post-basics">基本信息</h2>
            <p>标题与正文必填</p>
          </div>
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.titleField}`}>
              <span>文章标题</span>
              <input className="admin-input" required placeholder="输入清晰、具体的标题" value={form.title} onChange={(event) => updateTitle(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>文章地址</span>
              <div className={styles.slugControl}>
                <input className="admin-input" required placeholder="my-first-post" value={form.slug} onChange={(event) => { setSlugTouched(true); setForm({ ...form, slug: event.target.value }); }} />
                <button type="button" className="secondary-link" onClick={regenerateSlug}>重新生成</button>
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

        <section className={styles.formSection} aria-labelledby="new-post-series">
          <div className={styles.sectionHeading}>
            <h2 id="new-post-series">系列归档</h2>
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
              <CoverImageField value={form.coverUrl} onChange={(coverUrl) => setForm({ ...form, coverUrl })} disabled={submitting} />
            </div>
          </div>
          <div className={styles.stateRow}>
            <label><input type="checkbox" checked readOnly /><span>发布到站点</span></label>
            <label><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} /><span>仅后台可见</span></label>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="new-post-content">
          <div className={styles.sectionHeading}>
            <h2 id="new-post-content">正文</h2>
            <p>支持 Markdown 与实时预览</p>
          </div>
          <MarkdownEditor value={form.content} onChange={(content) => setForm({ ...form, content })} disabled={submitting} />
        </section>

        <section className={styles.formSection} aria-labelledby="new-post-blocks">
          <ContentBlocksEditor
            blocks={form.contentBlocks}
            onChange={(contentBlocks) => setForm({ ...form, contentBlocks })}
            disabled={submitting}
          />
        </section>

        <div className={styles.actionBar}>
          <button
            type="button"
            className="admin-button"
            onClick={submitPost}
            disabled={submitting}
          >
            {submitting ? "发布中..." : "发布文章"}
          </button>
        </div>
      </div>
    </main>
  );
}
