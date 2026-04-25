"use client";

import { marked } from "marked";
import { useMemo, useRef, useState } from "react";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const previewHtml = useMemo(() => {
    const source = value.trim()
      ? value
      : "## 预览区\n\n这里会实时显示正文的 Markdown 渲染效果。";

    return marked.parse(source, { async: false }) as string;
  }, [value]);

  const stats = useMemo(() => {
    const trimmed = value.trim();
    const lines = value ? value.split(/\r?\n/).length : 0;
    const imageCount = (value.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
    const cjkChars = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
    const latinWords = trimmed
      ? trimmed
          .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
          .replace(/[`*_>#-]/g, " ")
          .split(/\s+/)
          .filter(Boolean).length
      : 0;
    const readingUnits = cjkChars + latinWords;
    const readingMinutes = readingUnits > 0 ? Math.max(1, Math.ceil(readingUnits / 220)) : 0;

    return {
      chars: value.length,
      lines,
      imageCount,
      readingMinutes,
    };
  }, [value]);

  function getSelectionRange() {
    const textarea = textareaRef.current;

    if (!textarea) {
      return { start: value.length, end: value.length };
    }

    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  function replaceSelection(nextText: string, cursorOffset?: number) {
    const textarea = textareaRef.current;
    const { start, end } = getSelectionRange();
    const nextValue = `${value.slice(0, start)}${nextText}${value.slice(end)}`;

    onChange(nextValue);

    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }

      textarea.focus();
      const cursor = start + (cursorOffset ?? nextText.length);
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function wrapSelection(prefix: string, suffix = prefix, fallback = "文本") {
    const { start, end } = getSelectionRange();
    const selected = value.slice(start, end) || fallback;
    const nextText = `${prefix}${selected}${suffix}`;
    const cursorOffset =
      value.slice(start, end).length > 0
        ? nextText.length
        : prefix.length + fallback.length;

    replaceSelection(nextText, cursorOffset);
  }

  function insertBlock(snippet: string) {
    const { start, end } = getSelectionRange();
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const needsLeadingBreak = before && !before.endsWith("\n\n");
    const prefix = needsLeadingBreak ? "\n\n" : "";
    const body = selected ? `${snippet}${selected}` : snippet;

    replaceSelection(`${prefix}${body}`, `${prefix}${body}`.length);
  }

  async function handleInlineImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-admin-password": password,
        },
        body: formData,
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "正文图片上传失败。"
        );
      }

      const imageUrl = typeof data?.url === "string" ? data.url : "";

      if (!imageUrl) {
        throw new Error("上传成功，但没有拿到图片地址。");
      }

      insertBlock(`![图片描述](${imageUrl})\n\n`);
      setMessage("正文图片已插入 Markdown。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "正文图片上传失败。");
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="markdown-editor-shell">
      <div className="markdown-toolbar">
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("## 小标题\n\n")}
          disabled={disabled || uploading}
        >
          H2
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("### 小节标题\n\n")}
          disabled={disabled || uploading}
        >
          H3
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => wrapSelection("**")}
          disabled={disabled || uploading}
        >
          加粗
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => wrapSelection("*")}
          disabled={disabled || uploading}
        >
          斜体
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => wrapSelection("[", "](https://example.com)", "链接文本")}
          disabled={disabled || uploading}
        >
          链接
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("> 引用内容\n\n")}
          disabled={disabled || uploading}
        >
          引用
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("- 列表项 1\n- 列表项 2\n\n")}
          disabled={disabled || uploading}
        >
          无序列表
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("1. 列表项 1\n2. 列表项 2\n\n")}
          disabled={disabled || uploading}
        >
          有序列表
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("- [ ] 待办项 1\n- [ ] 待办项 2\n\n")}
          disabled={disabled || uploading}
        >
          待办清单
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("```ts\nconsole.log('hello')\n```\n\n")}
          disabled={disabled || uploading}
        >
          代码块
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => wrapSelection("`", "`", "code")}
          disabled={disabled || uploading}
        >
          行内代码
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => insertBlock("---\n\n")}
          disabled={disabled || uploading}
        >
          分割线
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() =>
            insertBlock("![图片描述](https://example.com/your-image.jpg)\n\n")
          }
          disabled={disabled || uploading}
        >
          插入图片语法
        </button>
        <button
          type="button"
          className="secondary-link markdown-tool"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? "上传中…" : "上传正文图片"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) =>
            void handleInlineImageUpload(event.target.files?.[0] || null)
          }
        />
      </div>

      <div className="markdown-hint">
        保持当前 linear 主题不变，编辑区新增了实时预览和常用 Markdown 快捷按钮。
      </div>

      <div className="markdown-stats">
        <span>字数 {stats.chars}</span>
        <span>行数 {stats.lines}</span>
        <span>图片 {stats.imageCount}</span>
        <span>预计阅读 {stats.readingMinutes} 分钟</span>
      </div>

      {message ? <div className="status-banner">{message}</div> : null}

      <div className="markdown-workspace">
        <textarea
          ref={textareaRef}
          className="admin-textarea markdown-textarea"
          placeholder="正文内容，支持 Markdown 和图片语法"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || uploading}
        />

        <div className="markdown-preview-shell">
          <div className="markdown-preview-label">实时预览</div>
          <div
            className="article-content markdown-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}
