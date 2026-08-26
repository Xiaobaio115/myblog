/**
 * 模型生成图片的解析与落地策略。
 *
 * 拆成纯函数是因为这一块的边界全在数据格式上：供应商回图的形状至少有四种，
 * 而判断错了的后果是图片被静默丢掉——既不报错也没有提示，
 * 表现为「模型说它画好了，但页面上什么都没有」，是最难查的一类问题。
 */

/**
 * 允许的图片类型。
 *
 * 白名单而不是黑名单：这些字节最终会进 markdown 的 img src，
 * 放开 svg 等于允许模型返回可执行脚本，哪怕来源是自己配的供应商也不该开。
 */
export const IMAGE_OUTPUT_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** 单张生成图的解码后体积上限。超过就丢弃，避免一次回答把内存和 Blob 额度打穿。 */
export const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * 未配置 Blob 时允许内联进正文的体积上限。
 *
 * 内联的 base64 会被原样存进会话文档，比二进制再大约 1/3。
 * 卡在 512KB 是为了让「没配 Blob 也能看到图」这件事成立，
 * 同时不至于让单条会话文档膨胀到接近 MongoDB 的 16MB 上限。
 */
export const MAX_INLINE_IMAGE_BYTES = 512 * 1024;

/** 单轮回答最多接收几张图。多于此数的部分丢弃。 */
export const MAX_IMAGES_PER_REPLY = 4;

export type GeneratedImage =
  | { kind: "url"; url: string }
  | { kind: "data"; mediaType: string; base64: string; bytes: number };

function isAllowedMediaType(value: string): boolean {
  return (IMAGE_OUTPUT_MEDIA_TYPES as readonly string[]).includes(value.toLowerCase());
}

/**
 * 由 base64 长度反推解码后字节数。
 *
 * 不真的解码：这里只是为了在超限时尽早丢弃，
 * 先 Buffer.from 一个 20MB 的字符串再判断大小就失去了限制的意义。
 */
export function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

/**
 * 解析 data URL 形式的图片。
 *
 * 这是生图模型压倒性使用的返回格式，也正是之前「配了多模态却始终不出图」的根因：
 * 旧的接收逻辑只认 https 开头的地址，data URL 一律当成无效丢掉。
 */
export function parseImageDataUrl(value: string): GeneratedImage | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(value.trim());
  if (!match) return null;
  const mediaType = match[1].toLowerCase();
  if (!isAllowedMediaType(mediaType)) return null;
  const base64 = match[2].replace(/\s/g, "");
  // base64 字母表之外的字符说明这不是干净的 base64，交给下游解码只会得到坏图片。
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = estimateBase64Bytes(base64);
  if (bytes <= 0 || bytes > MAX_GENERATED_IMAGE_BYTES) return null;
  return { kind: "data", mediaType, base64, bytes };
}

function normalizeImageString(value: string): GeneratedImage | null {
  const trimmed = value.trim();
  if (/^https:\/\//i.test(trimmed)) return { kind: "url", url: trimmed };
  if (/^data:/i.test(trimmed)) return parseImageDataUrl(trimmed);
  return null;
}

/**
 * 把供应商返回的一张图归一化。
 *
 * 兼容四种形状，都是实际存在的：裸字符串、`{url}`、`{image_url:{url}}`（OpenAI 兼容层）、
 * `{b64_json}`（images 接口）、`{inlineData:{mimeType,data}}`（Gemini 原生）。
 * 少认一种就等于对那家供应商静默不出图，所以宁可在这里写宽一点。
 */
export function normalizeGeneratedImage(value: unknown): GeneratedImage | null {
  if (typeof value === "string") return normalizeImageString(value);
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    url?: unknown;
    image_url?: unknown;
    b64_json?: unknown;
    data?: unknown;
    mediaType?: unknown;
    media_type?: unknown;
    mimeType?: unknown;
    mime_type?: unknown;
    inlineData?: unknown;
    inline_data?: unknown;
  };

  const inline = candidate.inlineData ?? candidate.inline_data;
  if (inline && typeof inline === "object") {
    const nested = normalizeGeneratedImage(inline);
    if (nested) return nested;
  }

  const nestedImageUrl = candidate.image_url;
  if (typeof nestedImageUrl === "string") {
    const parsed = normalizeImageString(nestedImageUrl);
    if (parsed) return parsed;
  } else if (nestedImageUrl && typeof nestedImageUrl === "object") {
    const url = (nestedImageUrl as { url?: unknown }).url;
    if (typeof url === "string") {
      const parsed = normalizeImageString(url);
      if (parsed) return parsed;
    }
  }

  if (typeof candidate.url === "string") {
    const parsed = normalizeImageString(candidate.url);
    if (parsed) return parsed;
  }

  // b64_json / inlineData.data 是裸 base64，不带 data URL 前缀，媒体类型得另外找。
  const rawBase64 = typeof candidate.b64_json === "string"
    ? candidate.b64_json
    : typeof candidate.data === "string" ? candidate.data : "";
  if (rawBase64) {
    const declared = [candidate.mediaType, candidate.media_type, candidate.mimeType, candidate.mime_type]
      .find((item): item is string => typeof item === "string" && Boolean(item.trim()));
    // 不声明类型时按 png 处理：这是生图接口最常见的默认，
    // 且浏览器对 img 的实际渲染依据是字节本身而非这里的标注。
    const mediaType = (declared || "image/png").toLowerCase();
    return parseImageDataUrl(`data:${mediaType};base64,${rawBase64.trim()}`);
  }

  return null;
}

/** 去重用的键。data URL 太长，取前后各一段拼起来，足够区分且不必比整串。 */
export function generatedImageKey(image: GeneratedImage): string {
  if (image.kind === "url") return `url:${image.url}`;
  return `data:${image.mediaType}:${image.bytes}:${image.base64.slice(0, 64)}:${image.base64.slice(-64)}`;
}

export function toDataUrl(image: GeneratedImage): string {
  return image.kind === "url" ? image.url : `data:${image.mediaType};base64,${image.base64}`;
}

/** 给 Blob 用的文件名。扩展名跟着媒体类型走，否则下载下来的文件打不开。 */
export function generatedImageFileName(image: GeneratedImage, seed: string): string {
  const mediaType = image.kind === "data" ? image.mediaType : "image/png";
  const extension = mediaType === "image/jpeg" ? "jpg" : mediaType.split("/")[1] || "png";
  return `ai-generated/${seed}.${extension}`;
}

const INLINE_IMAGE_PATTERN = /!\[([^\]]*)\]\(\s*data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+\)/gi;

/**
 * 把正文里内联的 base64 图片换成占位符。
 *
 * 必须在发给供应商之前做。生成的图片是以 markdown 的形式留在回答正文里的，
 * 若原样带着 data URL 进入下一轮历史，每轮都会把整段 base64 重新发一遍：
 * 开发者侧单条消息上限是 100 万字符，不会被截断，于是几张图就能把上下文吃光，
 * 表现为「聊几轮之后模型突然忘事」，而根因在几轮之前那张图上。
 */
export function stripInlineImageData(text: string): string {
  if (!text.includes("data:image/")) return text;
  return text.replace(INLINE_IMAGE_PATTERN, (_match, alt: string) => `![${alt || "图片"}](图片内容已省略)`);
}

/**
 * 存库前处理内联图片：留不下就换成说明文字。
 *
 * 存储层是按字符数截断的（访客侧单条回答 16000 字），而 512KB 的内联图片
 * base64 后约 70 万字符，会被从中间切断——base64 断在半个字符上就是一张坏图，
 * 页面上表现为「刷新之后图裂了」，且日志里什么都没有。
 *
 * 与其存一段注定损坏的字节，不如换成一句说明：当次会话里图片已经正常显示过，
 * 刷新后看到的是「为什么没留下」，而不是一个破图标。
 */
export function prepareContentForStorage(text: string, maxLength: number): string {
  if (!text.includes("data:image/")) return text;
  if (text.length <= maxLength) return text;
  return text.replace(
    INLINE_IMAGE_PATTERN,
    (_match, alt: string) => `![${alt || "图片"}](未保存)\n\n> 上面这张图未配置图床，仅在生成当次可见。配置 BLOB_READ_WRITE_TOKEN 后生成的图片会长期保存。`
  );
}
