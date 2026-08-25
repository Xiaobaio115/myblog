/**
 * 长会话的上下文预算管理。
 *
 * 后台 AI 页把全量历史发给模型，不受 maxHistoryMessages 限制。这样上下文不会丢，
 * 但会话足够长时必然撑爆模型窗口，由供应商抛错收场——这正是「输出到一半就断」
 * 和「重新生成时没有记忆」的根因之一。
 *
 * 这里的做法：估算 token 用量，超预算时把早期对话切出去交给模型压缩成摘要，
 * 只保留最近若干轮原文。摘要本身作为一条 system 消息带入，上下文因此不会整段丢失。
 */

export type BudgetMessage = { role: "user" | "assistant"; content: string };

/**
 * 无论如何都保留原文的最近消息条数的默认值，保证近期对话不被摘要模糊掉。
 *
 * 注意单位是「条」而不是「轮」：一问一答算 2 条，所以 8 条约等于 4 轮。
 * 实际取值由后台 contextVerbatimMessages 决定，这里只是兜底默认。
 */
export const MIN_VERBATIM_MESSAGES = 8;

/**
 * 粗略估算一段文本的 token 数。
 *
 * 不引入 tokenizer 依赖：这里只需要一个「够不够触发压缩」的量级判断，
 * 精确计数要靠供应商各自的分词器，本地算不准也没必要算准。
 * CJK 字符约 1 token/字，其余按 4 字符/token 估，并偏保守（宁可高估）。
 */
export function estimateTokens(text: string) {
  if (!text) return 0;
  let cjk = 0;
  for (const char of text) {
    const code = char.codePointAt(0) || 0;
    // CJK 统一表意文字、日文假名、韩文音节
    if (
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      cjk += 1;
    }
  }
  const rest = text.length - cjk;
  return Math.ceil(cjk + rest / 4);
}

export function estimateMessagesTokens(messages: BudgetMessage[]) {
  // 每条消息除正文外还有角色等固定开销，按 4 token 计
  return messages.reduce((sum, message) => sum + estimateTokens(message.content) + 4, 0);
}

/** 扣除系统消息后，留给历史消息的最低预算。低于这个值压缩会退化成「几乎只剩摘要」。 */
export const MIN_HISTORY_BUDGET_TOKENS = 1000;

/**
 * 从总预算中扣掉系统消息占用，得到真正留给历史消息的预算。
 *
 * 系统提示（自定义指令）和站内上下文同样计入模型窗口。不扣掉的话，
 * 配置的预算就是个虚数——指令写得越长，实际溢出得越多。
 */
export function resolveHistoryBudget(totalBudgetTokens: number, systemTexts: string[]) {
  const systemCost = systemTexts.reduce((sum, text) => sum + estimateTokens(text), 0);
  return Math.max(MIN_HISTORY_BUDGET_TOKENS, totalBudgetTokens - systemCost);
}

/**
 * 决定哪些消息需要被压缩。
 *
 * @param budgetTokens 留给历史消息的 token 预算（已扣除系统提示与预留输出空间）
 * @param minVerbatimMessages 最少保留原文的消息条数。设得足够大就等于关掉压缩：
 *   条数不够就直接全量原文发出，不做任何摘要。
 * @returns toSummarize 为需要压缩的早期消息，verbatim 为保留原文的近期消息
 */
export function planContextCompression(
  messages: BudgetMessage[],
  budgetTokens: number,
  minVerbatimMessages: number = MIN_VERBATIM_MESSAGES
): { needsCompression: boolean; toSummarize: BudgetMessage[]; verbatim: BudgetMessage[] } {
  // 负数或非整数会让后面的比较失去意义，这里先规整
  const minVerbatim = Math.max(1, Math.floor(minVerbatimMessages) || 1);
  const total = estimateMessagesTokens(messages);
  if (total <= budgetTokens || messages.length <= minVerbatim) {
    return { needsCompression: false, toSummarize: [], verbatim: messages };
  }

  // 从最近往前累加，尽量多保留原文，直到触及预算或触及最小保留条数下限
  let kept = 0;
  let index = messages.length;
  while (index > 0) {
    const next = messages[index - 1];
    const cost = estimateTokens(next.content) + 4;
    const keptCount = messages.length - index + 1;
    // 已满足最小保留条数、且再加一条会超预算，就停在这里
    if (keptCount > minVerbatim && kept + cost > budgetTokens) break;
    kept += cost;
    index -= 1;
  }

  // 至少要留下一条待压缩，否则压缩没有意义
  if (index <= 0) {
    return { needsCompression: false, toSummarize: [], verbatim: messages };
  }

  return {
    needsCompression: true,
    toSummarize: messages.slice(0, index),
    verbatim: messages.slice(index),
  };
}

/** 把待压缩的历史渲染成供摘要模型阅读的纯文本 */
export function renderTranscriptForSummary(messages: BudgetMessage[]) {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${message.content}`)
    .join("\n\n");
}

export const SUMMARY_SYSTEM_PROMPT =
  "你是对话压缩器。请把下面的历史对话压缩成简洁的中文要点，保留：用户的目标与约束、已确定的决定、" +
  "关键事实与数字、待办与未解决的问题、以及代码或文件名等具体标识。丢弃寒暄与重复内容。" +
  "不要评论、不要补充新信息，只输出要点本身。";

/** 摘要注入回上下文时的包装，让模型明确这段是压缩后的早期历史 */
export function wrapSummaryAsContext(summary: string) {
  if (!summary.trim()) return "";
  return `以下是本次对话早期内容的压缩摘要（原文已超出上下文预算，被替换为摘要）：\n\n${summary.trim()}`;
}
