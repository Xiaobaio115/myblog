import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttachmentContext,
  isBlobImageUrl,
  MAX_ATTACHMENT_CHARS,
  normalizeAttachments,
  normalizeImages,
} from "../lib/ai-attachments.ts";

// 1x1 透明 PNG，用来构造合法的 data URL
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wFPWkAAAAAASUVORK5CYII=";

test("图片地址只接受 Blob 白名单域名，防止接口被当作请求转发器", () => {
  assert.equal(
    isBlobImageUrl("https://abc123.public.blob.vercel-storage.com/ai-chat/x-9f.png"),
    true
  );
  // 非 Blob 域名：图片地址会被转发给模型供应商抓取，放行等于开放 SSRF 面
  assert.equal(isBlobImageUrl("https://evil.example.com/a.png"), false);
  // 域名后缀伪造
  assert.equal(isBlobImageUrl("https://public.blob.vercel-storage.com.evil.com/a.png"), false);
  // 非 https
  assert.equal(isBlobImageUrl("http://abc.public.blob.vercel-storage.com/a.png"), false);
  // 内网地址
  assert.equal(isBlobImageUrl("https://169.254.169.254/latest/meta-data"), false);
  // 扩展名不在白名单
  assert.equal(isBlobImageUrl("https://abc.public.blob.vercel-storage.com/a.svg"), false);
  assert.equal(isBlobImageUrl("not-a-url"), false);
});

test("normalizeImages 同时接受 Blob 地址与 data URL", () => {
  const blobUrl = "https://abc123.public.blob.vercel-storage.com/ai-chat/a-1.jpg";
  assert.deepEqual(normalizeImages([blobUrl]), { images: [blobUrl], error: "" });
  assert.deepEqual(normalizeImages([TINY_PNG]), { images: [TINY_PNG], error: "" });
  assert.deepEqual(normalizeImages(undefined), { images: [], error: "" });
});

test("normalizeImages 拒绝张数超限与非法格式", () => {
  const blobUrl = "https://abc123.public.blob.vercel-storage.com/ai-chat/a-1.jpg";
  const tooMany = normalizeImages([blobUrl, blobUrl, blobUrl, blobUrl]);
  assert.equal(tooMany.images.length, 0);
  assert.match(tooMany.error, /最多只能上传 3 张/);

  const badUrl = normalizeImages(["https://evil.example.com/a.png"]);
  assert.equal(badUrl.images.length, 0);
  assert.match(badUrl.error, /图片格式不正确/);

  assert.match(normalizeImages("not-array").error, /格式不正确/);
});

test("文本附件被截断到上限，且截断状态会被标记", () => {
  const long = "a".repeat(MAX_ATTACHMENT_CHARS + 500);
  const { attachments, error } = normalizeAttachments([{ name: "big.ts", text: long }]);
  assert.equal(error, "");
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].text.length, MAX_ATTACHMENT_CHARS);
  assert.equal(attachments[0].truncated, true);
});

test("附件数量与总量超限时整体拒绝", () => {
  const one = { name: "a.ts", text: "x" };
  assert.match(normalizeAttachments([one, one, one, one]).error, /最多只能附加 3 个文件/);

  const big = "b".repeat(MAX_ATTACHMENT_CHARS);
  const total = normalizeAttachments([
    { name: "1.ts", text: big },
    { name: "2.ts", text: big },
    { name: "3.ts", text: big },
  ]);
  assert.equal(total.attachments.length, 0);
  assert.match(total.error, /附件内容过长/);

  assert.match(normalizeAttachments(["plain-string"]).error, /附件格式不正确/);
  assert.deepEqual(normalizeAttachments(undefined), { attachments: [], error: "" });
});

test("空内容或无名附件被静默丢弃而非报错", () => {
  const { attachments, error } = normalizeAttachments([
    { name: "", text: "有内容但没名字" },
    { name: "empty.ts", text: "   " },
    { name: "ok.ts", text: "const a = 1;" },
  ]);
  assert.equal(error, "");
  assert.deepEqual(
    attachments.map((item) => item.name),
    ["ok.ts"]
  );
});

test("附件上下文按扩展名标注代码块语言", () => {
  const context = buildAttachmentContext([
    { name: "app/page.tsx", text: "export default function Page() {}", truncated: false },
  ]);
  assert.match(context, /文件：app\/page\.tsx/);
  assert.match(context, /```tsx/);
  assert.match(context, /export default function Page/);
  assert.equal(buildAttachmentContext([]), "");

  const truncated = buildAttachmentContext([{ name: "a.log", text: "x", truncated: true }]);
  assert.match(truncated, /仅包含前一部分/);
});
