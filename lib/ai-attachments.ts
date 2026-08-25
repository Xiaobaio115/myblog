/**
 * 聊天附件的校验与上下文拼装。
 *
 * 单独成模块的原因：这里是访客可触达的输入边界（图片地址会被转发给模型供应商去抓取，
 * 文件内容会被注入提示词），需要能在 node:test 里直接覆盖，而 route 文件依赖
 * next/server 无法被测试直接引入。
 */

export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_CHARS = 20000;
export const MAX_ATTACHMENT_TOTAL_CHARS = 48000;

export type TextAttachment = { name: string; text: string; truncated: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 判断是否为本站 Vercel Blob 的公开图片地址。
 *
 * 必须白名单到 Blob 域名，不能放行任意 URL：图片地址会被原样转发给模型供应商，
 * 由供应商服务器发起抓取。放开任意地址等于把这个接口变成可被利用的请求转发器。
 */
export function isBlobImageUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
  return /\.(jpe?g|png|webp|gif)$/i.test(parsed.pathname);
}

export function normalizeImages(value: unknown): { images: string[]; error: string } {
  if (value === undefined || value === null) return { images: [], error: "" };
  if (!Array.isArray(value)) return { images: [], error: "图片参数格式不正确。" };
  if (value.length > MAX_IMAGES) {
    return { images: [], error: `最多只能上传 ${MAX_IMAGES} 张图片。` };
  }

  let totalBytes = 0;
  const images: string[] = [];
  for (const item of value) {
    const raw = String(item || "");

    // 首选形态：客户端已直传到 Blob，这里只传一个短地址。
    // base64 内联会让请求体膨胀约 1/3，撞上 Vercel Functions 4.5MB 的请求体上限，
    // 保留 data URL 分支只是为了兼容未配置 Blob 的自托管部署。
    if (isBlobImageUrl(raw)) {
      images.push(raw);
      continue;
    }

    const match = raw.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i
    );
    if (!match || !ALLOWED_IMAGE_TYPES.has(match[1].toLowerCase())) {
      return { images: [], error: "图片格式不正确，仅支持 JPG、PNG、WebP 和 GIF。" };
    }
    const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
    const bytes = (match[2].length * 3) / 4 - padding;
    if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
      return { images: [], error: "单张图片不能超过 4MB。" };
    }
    if (totalBytes + bytes > MAX_TOTAL_IMAGE_BYTES) {
      return { images: [], error: "图片总大小不能超过 8MB。" };
    }
    totalBytes += bytes;
    images.push(raw);
  }
  return { images, error: "" };
}

/**
 * 归一化文本/代码附件。
 *
 * 附件内容不拼进用户消息正文：正文受 maxMessageLength（默认 2000 字）限制，
 * 一个几百行的代码文件会直接被判为「消息太长」。改为作为独立上下文注入，
 * 顺带的好处是非多模态模型也能读到文件内容。
 */
export function normalizeAttachments(value: unknown): { attachments: TextAttachment[]; error: string } {
  if (value === undefined || value === null) return { attachments: [], error: "" };
  if (!Array.isArray(value)) return { attachments: [], error: "附件参数格式不正确。" };
  if (value.length > MAX_ATTACHMENTS) {
    return { attachments: [], error: `最多只能附加 ${MAX_ATTACHMENTS} 个文件。` };
  }

  const attachments: TextAttachment[] = [];
  let totalChars = 0;
  for (const item of value) {
    if (!isRecord(item)) return { attachments: [], error: "附件格式不正确。" };
    const name = String(item.name || "").slice(0, 160).trim();
    const text = String(item.text || "");
    if (!name || !text.trim()) continue;
    const clipped = text.slice(0, MAX_ATTACHMENT_CHARS);
    if (totalChars + clipped.length > MAX_ATTACHMENT_TOTAL_CHARS) {
      return { attachments: [], error: "附件内容过长，请减少文件数量或精简内容。" };
    }
    totalChars += clipped.length;
    attachments.push({
      name,
      text: clipped,
      truncated: item.truncated === true || text.length > MAX_ATTACHMENT_CHARS,
    });
  }
  return { attachments, error: "" };
}

/** 把附件拼成一段模型可读的上下文 */
export function buildAttachmentContext(attachments: TextAttachment[]) {
  if (!attachments.length) return "";
  const blocks = attachments.map((attachment) => {
    const dot = attachment.name.lastIndexOf(".");
    const language = dot === -1 ? "" : attachment.name.slice(dot + 1).toLowerCase();
    const note = attachment.truncated ? "（内容过长，仅包含前一部分）" : "";
    return `文件：${attachment.name}${note}\n\`\`\`${language}\n${attachment.text}\n\`\`\``;
  });
  return `用户随本次提问附加了以下文件，请结合文件内容回答：\n\n${blocks.join("\n\n")}`;
}
