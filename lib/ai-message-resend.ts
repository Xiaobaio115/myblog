/**
 * 「重发上一条提问」的纯逻辑。
 *
 * 抽出来的原因和 ai-model-picker 一样：AiChatPage 是 "use client" 组件，
 * node:test 没法直接 import，而这里的边界条件（找不到用户消息、图片能不能带回、
 * 文本附件为什么带不回）恰恰是最容易改坏的部分，必须能单独测。
 */

export type ResendMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageNames?: string[];
  imagePreviews?: string[];
  fileNames?: string[];
};

export type ResendImage = { name: string; url: string };

export type ResendPlan = {
  /** 该用户消息在 messages 里的下标，重发时历史回退到这里 */
  index: number;
  message: ResendMessage;
  /** 可以原样重发的图片，已按当前模型的读图能力过滤 */
  images: ResendImage[];
  /** 图片因模型不支持读图而被摘掉 */
  imagesDropped: boolean;
  /** 带不回来的文本附件文件名 */
  lostFileNames: string[];
};

/** 最后一条用户消息的下标，没有则返回 -1。 */
export function findLastUserIndex(messages: Array<Pick<ResendMessage, "role">>): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

/**
 * 规划一次重发。
 *
 * imagePreviews 存的就是当初发给模型的那个 url（Blob 公网地址或 data URL），
 * 所以图片能原样重发。文本附件只留了文件名——正文走的是独立的 attachments 字段、
 * 没有持久化——所以只能报出文件名让用户重新添加，不能假装还带着。
 */
export function planResend(messages: ResendMessage[], modelSupportsVision: boolean): ResendPlan | null {
  const index = findLastUserIndex(messages);
  if (index === -1) return null;
  const message = messages[index];
  const urls = message.imagePreviews || [];
  const names = message.imageNames || [];
  const images = urls.map((url, imageIndex) => ({
    name: names[imageIndex] || `图片${imageIndex + 1}`,
    url,
  }));
  // 不支持读图的模型收到 images 会被服务端直接拒绝，所以宁可摘掉并告知，
  // 也不能带着它去撞一个必然失败的请求。
  const keepImages = modelSupportsVision || images.length === 0;
  return {
    index,
    message,
    images: keepImages ? images : [],
    imagesDropped: !keepImages,
    lostFileNames: message.fileNames || [],
  };
}

/**
 * 合并「重发带回的图片」与「输入框里已排队的图片」，按 url 去重。
 *
 * 去重按 url 而不是文件名：同名文件可能是两张不同的图，
 * 而同一个 url 一定是同一张，重复发送只是白烧 token。
 */
export function mergeImagesByUrl(restored: ResendImage[], pending: ResendImage[]): ResendImage[] {
  const seen = new Set<string>();
  const merged: ResendImage[] = [];
  for (const image of [...restored, ...pending]) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    merged.push(image);
  }
  return merged;
}

/** 重发后交代附件去向的提示文案；没有任何丢失时返回空串。 */
export function describeResendFallout(imagesDropped: boolean, lostFileNames: string[]): string {
  const parts: string[] = [];
  if (imagesDropped) parts.push("当前模型不支持读图，原消息的图片没有重发");
  if (lostFileNames.length > 0) parts.push(`文本附件（${lostFileNames.join("、")}）需要重新添加`);
  return parts.length > 0 ? `${parts.join("；")}。` : "";
}
