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
