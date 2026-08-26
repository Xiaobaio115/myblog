import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateBase64Bytes,
  generatedImageFileName,
  generatedImageKey,
  MAX_GENERATED_IMAGE_BYTES,
  normalizeGeneratedImage,
  parseImageDataUrl,
  prepareContentForStorage,
  stripInlineImageData,
  toDataUrl,
} from "../lib/ai-image-output.ts";

/** 1x1 透明 PNG，最小的合法样本 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

function bigBase64(bytes) {
  return Buffer.alloc(bytes, 1).toString("base64");
}

test("estimateBase64Bytes 按补位字符反推解码后大小", () => {
  assert.equal(estimateBase64Bytes(""), 0);
  assert.equal(estimateBase64Bytes(Buffer.from("a").toString("base64")), 1);
  assert.equal(estimateBase64Bytes(Buffer.from("ab").toString("base64")), 2);
  assert.equal(estimateBase64Bytes(Buffer.from("abc").toString("base64")), 3);
  assert.equal(estimateBase64Bytes(Buffer.alloc(3000).toString("base64")), 3000);
});

test("parseImageDataUrl 接受白名单内的媒体类型", () => {
  for (const mediaType of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
    const parsed = parseImageDataUrl(`data:${mediaType};base64,${PNG_BASE64}`);
    assert.equal(parsed?.kind, "data");
    assert.equal(parsed?.mediaType, mediaType);
  }
});

test("parseImageDataUrl 拒绝 svg —— 它能携带可执行脚本", () => {
  assert.equal(parseImageDataUrl(`data:image/svg+xml;base64,${PNG_BASE64}`), null);
});

test("parseImageDataUrl 拒绝非图片与畸形输入", () => {
  assert.equal(parseImageDataUrl(`data:text/html;base64,${PNG_BASE64}`), null);
  assert.equal(parseImageDataUrl("data:image/png;base64,"), null);
  assert.equal(parseImageDataUrl("https://example.com/a.png"), null);
  assert.equal(parseImageDataUrl(""), null);
  // base64 字母表之外的字符：交给下游解码只会得到坏图片，不如在这里挡掉
  assert.equal(parseImageDataUrl("data:image/png;base64,!!!!"), null);
});

test("parseImageDataUrl 卡住超大图片", () => {
  const oversize = `data:image/png;base64,${bigBase64(MAX_GENERATED_IMAGE_BYTES + 1024)}`;
  assert.equal(parseImageDataUrl(oversize), null);
});

test("normalizeGeneratedImage 认得供应商用的各种形状", () => {
  const dataUrl = `data:image/png;base64,${PNG_BASE64}`;

  assert.deepEqual(normalizeGeneratedImage("https://cdn.example.com/a.png"), {
    kind: "url",
    url: "https://cdn.example.com/a.png",
  });
  assert.equal(normalizeGeneratedImage(dataUrl)?.kind, "data");
  assert.equal(normalizeGeneratedImage({ url: dataUrl })?.kind, "data");
  assert.equal(normalizeGeneratedImage({ image_url: dataUrl })?.kind, "data");
  assert.equal(normalizeGeneratedImage({ image_url: { url: dataUrl } })?.kind, "data");
  // OpenAI images 接口：裸 base64，不带前缀
  assert.equal(normalizeGeneratedImage({ b64_json: PNG_BASE64 })?.mediaType, "image/png");
  // Gemini 原生：inlineData 嵌一层，媒体类型另外声明
  assert.equal(
    normalizeGeneratedImage({ inlineData: { mimeType: "image/jpeg", data: PNG_BASE64 } })?.mediaType,
    "image/jpeg"
  );
  assert.equal(
    normalizeGeneratedImage({ inline_data: { mime_type: "image/webp", data: PNG_BASE64 } })?.mediaType,
    "image/webp"
  );
});

test("normalizeGeneratedImage 拒绝 http 明文地址", () => {
  assert.equal(normalizeGeneratedImage("http://cdn.example.com/a.png"), null);
});

test("normalizeGeneratedImage 对空值和无关对象返回 null", () => {
  for (const value of [null, undefined, 0, "", {}, [], { url: 123 }, { b64_json: 5 }]) {
    assert.equal(normalizeGeneratedImage(value), null);
  }
});

test("normalizeGeneratedImage 不声明媒体类型时按 png 处理", () => {
  assert.equal(normalizeGeneratedImage({ b64_json: PNG_BASE64 })?.mediaType, "image/png");
});

test("generatedImageKey 能区分不同图片、并对同一张给出同一个键", () => {
  const a = normalizeGeneratedImage(`data:image/png;base64,${PNG_BASE64}`);
  const b = normalizeGeneratedImage(`data:image/png;base64,${PNG_BASE64}`);
  const c = normalizeGeneratedImage("https://cdn.example.com/a.png");
  assert.equal(generatedImageKey(a), generatedImageKey(b));
  assert.notEqual(generatedImageKey(a), generatedImageKey(c));
});

test("toDataUrl 还原可直接放进 img src 的地址", () => {
  assert.equal(toDataUrl({ kind: "url", url: "https://a/b.png" }), "https://a/b.png");
  assert.equal(
    toDataUrl({ kind: "data", mediaType: "image/png", base64: PNG_BASE64, bytes: 70 }),
    `data:image/png;base64,${PNG_BASE64}`
  );
});

test("generatedImageFileName 的扩展名跟着媒体类型走", () => {
  const jpeg = { kind: "data", mediaType: "image/jpeg", base64: PNG_BASE64, bytes: 70 };
  assert.equal(generatedImageFileName(jpeg, "seed"), "ai-generated/seed.jpg");
  const webp = { kind: "data", mediaType: "image/webp", base64: PNG_BASE64, bytes: 70 };
  assert.equal(generatedImageFileName(webp, "seed"), "ai-generated/seed.webp");
  assert.equal(generatedImageFileName({ kind: "url", url: "https://a/b" }, "seed"), "ai-generated/seed.png");
});

test("stripInlineImageData 换掉内联 base64、保留 alt 文本", () => {
  const text = `看这张\n\n![AI 生成图片](data:image/png;base64,${PNG_BASE64})\n\n好看吗`;
  const stripped = stripInlineImageData(text);
  assert.ok(!stripped.includes("base64"));
  assert.ok(stripped.includes("![AI 生成图片](图片内容已省略)"));
  assert.ok(stripped.includes("看这张"));
  assert.ok(stripped.includes("好看吗"));
});

test("stripInlineImageData 不动普通 https 图片", () => {
  const text = "![封面](https://cdn.example.com/cover.png)";
  assert.equal(stripInlineImageData(text), text);
});

test("stripInlineImageData 对不含内联图片的文本原样返回", () => {
  const text = "普通一句话，带个链接 https://example.com 和 `data:` 这个词";
  assert.equal(stripInlineImageData(text), text);
});

test("stripInlineImageData 处理同一段里的多张图", () => {
  const one = `![a](data:image/png;base64,${PNG_BASE64})`;
  const two = `![b](data:image/jpeg;base64,${PNG_BASE64})`;
  const stripped = stripInlineImageData(`${one} 中间 ${two}`);
  assert.equal(stripped, "![a](图片内容已省略) 中间 ![b](图片内容已省略)");
});

test("stripInlineImageData 对 alt 为空的图片补上占位文字", () => {
  const stripped = stripInlineImageData(`![](data:image/png;base64,${PNG_BASE64})`);
  assert.equal(stripped, "![图片](图片内容已省略)");
});

test("prepareContentForStorage 放过能完整存下的内联图片", () => {
  const text = `![图](data:image/png;base64,${PNG_BASE64})`;
  assert.equal(prepareContentForStorage(text, 16_000), text);
});

test("prepareContentForStorage 换掉存不下的内联图片，而不是让它被切断", () => {
  const huge = `![图](data:image/png;base64,${bigBase64(600 * 1024)})`;
  const prepared = prepareContentForStorage(huge, 16_000);
  assert.ok(!prepared.includes("base64"));
  assert.ok(prepared.includes("未保存"));
  assert.ok(prepared.includes("BLOB_READ_WRITE_TOKEN"));
  // 换完之后必须真的能存下，否则等于没解决问题
  assert.ok(prepared.length <= 16_000);
});

test("prepareContentForStorage 不动不含内联图片的长文本", () => {
  const long = "字".repeat(20_000);
  assert.equal(prepareContentForStorage(long, 16_000), long);
});

test("prepareContentForStorage 保留 https 图片，只处理内联的那张", () => {
  const text = `![远程](https://cdn.example.com/a.png) 和 ![内联](data:image/png;base64,${bigBase64(600 * 1024)})`;
  const prepared = prepareContentForStorage(text, 16_000);
  assert.ok(prepared.includes("https://cdn.example.com/a.png"));
  assert.ok(!prepared.includes("base64"));
});
