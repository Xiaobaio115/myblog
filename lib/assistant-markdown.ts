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

function isSafeImage(value: string) {
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
