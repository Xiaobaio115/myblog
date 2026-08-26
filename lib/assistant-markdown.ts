import { marked } from "marked";

const INTERNAL_ORIGIN = "https://internal.invalid";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function isSafeLink(value: string) {
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * 允许内联展示的图片 data URL。
 *
 * 未配置 Blob 时，模型生成的图片会以 base64 内联进正文，不放开这一条的话
 * 图片会被降级成一行 alt 文字——功能看着像坏了，实际是被这里挡掉的。
 *
 * 类型白名单和 base64 形状都要卡死：这段文本名义上来自模型，
 * 但真正的信任边界在这里，不能假设上游已经校验过。
 * 尤其不能放开 svg，它能携带可执行脚本。
 */
const SAFE_INLINE_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i;

function isSafeImage(value: string) {
  if (SAFE_INLINE_IMAGE.test(value.trim())) return true;
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function renderAssistantMarkdown(source: string) {
  const renderer = new marked.Renderer();

  // AI output is untrusted: discard raw HTML and allow only HTTPS or same-site images.
  renderer.html = () => "";
  renderer.image = ({ href, title, text }) => {
    if (!isSafeImage(href)) return escapeHtml(text || "图片");
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text || "AI 图片")}"${titleAttribute} loading="lazy" decoding="async">`;
  };
  renderer.link = function renderLink({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    if (!isSafeLink(href)) return label;

    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
    const externalAttribute = href.startsWith("/")
      ? ""
      : ' target="_blank" rel="noreferrer noopener"';
    return `<a href="${escapeHtml(href)}"${titleAttribute}${externalAttribute}>${label}</a>`;
  };

  return marked.parse(source, {
    renderer,
    gfm: true,
    breaks: true,
    async: false,
  }) as string;
}
