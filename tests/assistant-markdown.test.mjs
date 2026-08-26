import test from "node:test";
import assert from "node:assert/strict";
import { renderAssistantMarkdown } from "../lib/assistant-markdown.ts";

test("assistant Markdown renders code, emoji and common formatting", () => {
  const html = renderAssistantMarkdown([
    "你好 😊",
    "",
    "**重点** `inline()`",
    "",
    "> 一段引用",
    "",
    "- 第一项",
    "- 第二项",
    "",
    "[站内文章](/articles)",
    "",
    "```ts",
    "const answer = 42;",
    "```",
  ].join("\n"));

  assert.ok(html.includes("<strong>重点</strong>"));
  assert.ok(html.includes("<code>inline()</code>"));
  assert.match(html, /<blockquote>[\s\S]*一段引用/);
  assert.match(html, /<ul>[\s\S]*第一项[\s\S]*第二项/);
  assert.match(html, /<a href="\/articles">站内文章<\/a>/);
  assert.match(html, /<pre><code class="language-ts">[\s\S]*answer = 42/);
  assert.match(html, /😊/);
});

test("assistant Markdown drops raw HTML and unsafe links while allowing safe images", () => {
  const html = renderAssistantMarkdown('<script>alert("xss")</script>');
  const linkHtml = renderAssistantMarkdown("[危险](javascript:alert(1))");
  const imageHtml = renderAssistantMarkdown("![追踪图](https://example.com/pixel.gif)");

  assert.doesNotMatch(html, /script|javascript:/i);
  assert.doesNotMatch(linkHtml, /javascript:/i);
  assert.match(linkHtml, /危险/);
  assert.match(imageHtml, /<img[^>]+https:\/\/example\.com\/pixel\.gif/i);
  assert.match(imageHtml, /追踪图/);
});

test("assistant Markdown 渲染内联的生成图片", () => {
  // 1x1 PNG。未配置 Blob 时生成的图片就以这种形式内联进正文，
  // 这里挡掉的话图片会被降级成一行 alt 文字。
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
  for (const mediaType of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
    const html = renderAssistantMarkdown(`![AI 生成图片](data:${mediaType};base64,${png})`);
    assert.match(html, /<img[^>]+src="data:image\//i);
  }
});

test("assistant Markdown 仍然挡掉 svg 和畸形的 data URL", () => {
  const svg = renderAssistantMarkdown("![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)");
  assert.doesNotMatch(svg, /<img/i);
  assert.match(svg, /x/);

  // 非 base64 的 data URL：直接写明文 svg，历史上是绕过白名单最常用的一招
  const plain = renderAssistantMarkdown("![y](data:image/svg+xml,<svg onload=alert(1)>)");
  assert.doesNotMatch(plain, /<img/i);
  assert.doesNotMatch(plain, /onload/i);

  const bogus = renderAssistantMarkdown("![z](data:image/png;base64,!!!)");
  assert.doesNotMatch(bogus, /<img/i);
});
