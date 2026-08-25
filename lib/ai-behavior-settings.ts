import "server-only";
import { getDb } from "@/lib/mongodb";
import {
  AI_PROMPT_CONTROL_DEFAULTS,
  type AiPromptControls,
} from "@/lib/ai-prompt";

const SETTINGS_KEY = "aiBehavior";

export type AiMode = "guide" | "companion" | "technical" | "writer";
export type AiModeText = Record<AiMode, string>;

export type AiCapabilities = {
  searchArticles: boolean;
  searchPhotos: boolean;
  searchProjects: boolean;
  searchTravel: boolean;
  recommendations: boolean;
  navigation: boolean;
};

export type AiBehavior = {
  systemPrompt: string;
  knowledgeText: string;
  mode: AiMode;
  enabledModes: AiMode[];
  modeLabels: AiModeText;
  modePrompts: AiModeText;
  promptControls: AiPromptControls;
  capabilities: AiCapabilities;
  conversationHistoryEnabled: boolean;
  conversationRetentionDays: number;
  maxConversationsPerVisitor: number;
  dailyLimit: number;
  maxMessageLength: number;
  maxHistoryMessages: number;
  maxOutputTokens: number;
  temperature: number;
  /** 是否允许在聊天里附加图片与文件 */
  uploadEnabled: boolean;
  /** 上传限额的统计窗口天数 */
  uploadWindowDays: number;
  /** 每个 IP 在一个窗口内的上传次数上限 */
  uploadLimitPerWindow: number;
  /**
   * 直传令牌有效期（分钟）。
   * 这是一张真实的写入凭证，有效期内泄露即可被用来上传，配得越长风险越大。
   */
  uploadTokenTtlMinutes: number;
  /**
   * 后台 AI 页留给历史消息的 token 预算。
   * 超出后早期对话会被压缩成摘要，而不是被直接截断丢弃。
   */
  contextBudgetTokens: number;
  /**
   * 压缩时至少保留多少条最近消息的原文（单位是条，一问一答算 2 条）。
   * 调到比会话长度还大就等于关掉压缩：全量原文照发，代价是可能撞模型窗口。
   */
  contextVerbatimMessages: number;
};

const AI_MODES: AiMode[] = ["guide", "companion", "technical", "writer"];

export const AI_MODE_LABEL_DEFAULTS: AiModeText = {
  guide: "导览",
  companion: "聊天",
  technical: "技术",
  writer: "写作",
};

export const AI_MODE_PROMPT_DEFAULTS: AiModeText = {
  guide: "你当前是站点导览模式：优先回答博客内容在哪里、如何打开，并引用检索到的站内资料。",
  companion: "你当前是陪伴聊天模式：语气自然、温和、有一点个性；仍然可以使用站内资料，但不要为了闲聊强行推荐页面。",
  technical: "你当前是技术助手模式：优先解释实现原理、技术栈、代码结构和取舍；涉及博客内容时要区分已知资料与推测。",
  writer: "你当前是写作助手模式：可以帮助用户拟标题、写摘要、整理大纲和润色文字；不要擅自发布或修改站点内容。",
};

export const AI_BEHAVIOR_DEFAULTS: AiBehavior = {
  systemPrompt: `你是这个个人博客的 AI 助手，名字叫甘蔗。
你的语气像朋友一样自然、简洁、温和，什么话题都可以聊。
你可以介绍博客的首页、文章、相册、3D 星空相册、我的世界、旅行地图等内容。
  回答以中文为主，尽量简短；只有用户明确要求详细说明时才展开。`,
  knowledgeText: `这是 LQPP 的个人博客。公开模块包括首页、文章与系列、普通照片墙、3D 星空相册、项目页、旅行地图和留言板。
站内检索到的文章、照片、项目和旅行地点才是最新事实；不确定的内容要明确说明，不要编造。`,
  mode: "guide",
  enabledModes: ["guide", "companion", "technical", "writer"],
  modeLabels: { ...AI_MODE_LABEL_DEFAULTS },
  modePrompts: { ...AI_MODE_PROMPT_DEFAULTS },
  promptControls: { ...AI_PROMPT_CONTROL_DEFAULTS },
  capabilities: {
    searchArticles: true,
    searchPhotos: true,
    searchProjects: true,
    searchTravel: true,
    recommendations: true,
    navigation: true,
  },
  conversationHistoryEnabled: true,
  conversationRetentionDays: 30,
  maxConversationsPerVisitor: 20,
  dailyLimit: 20,
  maxMessageLength: 2000,
  maxHistoryMessages: 12,
  // 300 tokens 只够约 200 个汉字，长回答必被截断；2048 是常见长度回答的稳妥默认值。
  maxOutputTokens: 2048,
  temperature: 0.7,
  uploadEnabled: true,
  uploadWindowDays: 7,
  uploadLimitPerWindow: 12,
  uploadTokenTtlMinutes: 7 * 24 * 60,
  // 取 32k：主流模型窗口普遍 ≥64k，留一半给摘要、系统提示和本轮输出，
  // 既不会频繁触发摘要，也不至于把窗口撑满。
  contextBudgetTokens: 32000,
  contextVerbatimMessages: 8,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number, integer = false) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(max, Math.max(min, numeric));
  return integer ? Math.round(bounded) : bounded;
}

function normalizeModeText(
  value: unknown,
  defaults: AiModeText,
  maxLength: number,
  allowEmpty = false
): AiModeText {
  const source = value && typeof value === "object"
    ? value as Partial<Record<AiMode, unknown>>
    : {};

  return Object.fromEntries(
    AI_MODES.map((mode) => {
      if (typeof source[mode] !== "string") return [mode, defaults[mode]];
      const text = source[mode].trim().slice(0, maxLength);
      return [mode, allowEmpty ? text : text || defaults[mode]];
    })
  ) as AiModeText;
}

function normalizePromptControls(value: unknown): AiPromptControls {
  const source = value && typeof value === "object"
    ? value as Partial<AiPromptControls>
    : {};

  return Object.fromEntries(
    Object.entries(AI_PROMPT_CONTROL_DEFAULTS).map(([key, fallback]) => [
      key,
      typeof source[key as keyof AiPromptControls] === "boolean"
        ? source[key as keyof AiPromptControls]
        : fallback,
    ])
  ) as AiPromptControls;
}

function normalizeBehavior(value: Partial<AiBehavior>): AiBehavior {
  const systemPrompt = typeof value.systemPrompt === "string"
    ? value.systemPrompt.trim().slice(0, 8000)
    : AI_BEHAVIOR_DEFAULTS.systemPrompt;
  const knowledgeText = typeof value.knowledgeText === "string"
    ? value.knowledgeText.trim().slice(0, 12000)
    : AI_BEHAVIOR_DEFAULTS.knowledgeText;

  const requestedModes = Array.isArray(value.enabledModes)
    ? value.enabledModes.filter((mode): mode is AiMode =>
        AI_MODES.includes(String(mode) as AiMode)
      )
    : AI_BEHAVIOR_DEFAULTS.enabledModes;
  const enabledModes = Array.from(new Set(requestedModes));
  const requestedMode = value.mode && AI_MODES.includes(value.mode)
    ? value.mode
    : AI_BEHAVIOR_DEFAULTS.mode;
  const mode = enabledModes.includes(requestedMode)
    ? requestedMode
    : enabledModes[0] || AI_BEHAVIOR_DEFAULTS.mode;
  const storedCapabilities: Partial<AiCapabilities> =
    value.capabilities && typeof value.capabilities === "object"
      ? value.capabilities
      : {};

  return {
    systemPrompt,
    knowledgeText,
    mode,
    enabledModes: enabledModes.length > 0 ? enabledModes : [AI_BEHAVIOR_DEFAULTS.mode],
    modeLabels: normalizeModeText(value.modeLabels, AI_MODE_LABEL_DEFAULTS, 40),
    modePrompts: normalizeModeText(value.modePrompts, AI_MODE_PROMPT_DEFAULTS, 2400, true),
    promptControls: normalizePromptControls(value.promptControls),
    capabilities: {
      searchArticles: typeof storedCapabilities.searchArticles === "boolean" ? storedCapabilities.searchArticles : AI_BEHAVIOR_DEFAULTS.capabilities.searchArticles,
      searchPhotos: typeof storedCapabilities.searchPhotos === "boolean" ? storedCapabilities.searchPhotos : AI_BEHAVIOR_DEFAULTS.capabilities.searchPhotos,
      searchProjects: typeof storedCapabilities.searchProjects === "boolean" ? storedCapabilities.searchProjects : AI_BEHAVIOR_DEFAULTS.capabilities.searchProjects,
      searchTravel: typeof storedCapabilities.searchTravel === "boolean" ? storedCapabilities.searchTravel : AI_BEHAVIOR_DEFAULTS.capabilities.searchTravel,
      recommendations: typeof storedCapabilities.recommendations === "boolean" ? storedCapabilities.recommendations : AI_BEHAVIOR_DEFAULTS.capabilities.recommendations,
      navigation: typeof storedCapabilities.navigation === "boolean" ? storedCapabilities.navigation : AI_BEHAVIOR_DEFAULTS.capabilities.navigation,
    },
    conversationHistoryEnabled: typeof value.conversationHistoryEnabled === "boolean"
      ? value.conversationHistoryEnabled
      : AI_BEHAVIOR_DEFAULTS.conversationHistoryEnabled,
    conversationRetentionDays: clampNumber(
      value.conversationRetentionDays,
      AI_BEHAVIOR_DEFAULTS.conversationRetentionDays,
      1,
      365,
      true
    ),
    maxConversationsPerVisitor: clampNumber(
      value.maxConversationsPerVisitor,
      AI_BEHAVIOR_DEFAULTS.maxConversationsPerVisitor,
      1,
      50,
      true
    ),
    dailyLimit: clampNumber(value.dailyLimit, AI_BEHAVIOR_DEFAULTS.dailyLimit, 1, 1000, true),
    maxMessageLength: clampNumber(value.maxMessageLength, AI_BEHAVIOR_DEFAULTS.maxMessageLength, 50, 32000, true),
    maxHistoryMessages: clampNumber(value.maxHistoryMessages, AI_BEHAVIOR_DEFAULTS.maxHistoryMessages, 1, 60, true),
    // 上限放宽到 32768，配合现代模型的长输出能力；实际可用值仍受供应商模型限制。
    maxOutputTokens: clampNumber(value.maxOutputTokens, AI_BEHAVIOR_DEFAULTS.maxOutputTokens, 32, 32000, true),
    temperature: clampNumber(value.temperature, AI_BEHAVIOR_DEFAULTS.temperature, 0, 2),
    uploadEnabled: typeof value.uploadEnabled === "boolean"
      ? value.uploadEnabled
      : AI_BEHAVIOR_DEFAULTS.uploadEnabled,
    uploadWindowDays: clampNumber(value.uploadWindowDays, AI_BEHAVIOR_DEFAULTS.uploadWindowDays, 1, 365, true),
    uploadLimitPerWindow: clampNumber(
      value.uploadLimitPerWindow,
      AI_BEHAVIOR_DEFAULTS.uploadLimitPerWindow,
      1,
      1000,
      true
    ),
    // 上限 7 天。再长的写入凭证没有实际收益，只会放大泄露后的可利用窗口。
    uploadTokenTtlMinutes: clampNumber(
      value.uploadTokenTtlMinutes,
      AI_BEHAVIOR_DEFAULTS.uploadTokenTtlMinutes,
      1,
      7 * 24 * 60,
      true
    ),
    // 下限 4000：低于这个值 planContextCompression 会几乎每轮都触发摘要，
    // 上限 200000：超出主流模型窗口后设得再高也没有意义。
    contextBudgetTokens: clampNumber(
      value.contextBudgetTokens,
      AI_BEHAVIOR_DEFAULTS.contextBudgetTokens,
      4000,
      200000,
      true
    ),
    // 上限 100000 而不是几十：这是给开发者自己用的，调到大于会话长度就等于关掉压缩，
    // 属于「我知道会撞窗口，但我要全量原文」的正当选择，不该被产品逻辑拦住。
    // 下限 1：至少要留下当轮提问的原文，否则模型连问题本身都看不到。
    contextVerbatimMessages: clampNumber(
      value.contextVerbatimMessages,
      AI_BEHAVIOR_DEFAULTS.contextVerbatimMessages,
      1,
      100000,
      true
    ),
  };
}

export function getAiModePrompt(mode: AiMode, prompts: AiModeText = AI_MODE_PROMPT_DEFAULTS) {
  return typeof prompts[mode] === "string"
    ? prompts[mode]
    : AI_MODE_PROMPT_DEFAULTS[mode] || AI_MODE_PROMPT_DEFAULTS.guide;
}

export async function getAiBehavior(): Promise<AiBehavior> {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY });
    if (doc?.value) {
      const stored = doc.value as Partial<AiBehavior>;
      return normalizeBehavior(stored);
    }
    return { ...AI_BEHAVIOR_DEFAULTS };
  } catch {
    return { ...AI_BEHAVIOR_DEFAULTS };
  }
}

export async function saveAiBehavior(behavior: Partial<AiBehavior>): Promise<AiBehavior> {
  const current = await getAiBehavior();
  const merged = normalizeBehavior({
    systemPrompt: behavior.systemPrompt ?? current.systemPrompt,
    knowledgeText: behavior.knowledgeText ?? current.knowledgeText,
    mode: behavior.mode ?? current.mode,
    enabledModes: behavior.enabledModes ?? current.enabledModes,
    modeLabels: behavior.modeLabels ?? current.modeLabels,
    modePrompts: behavior.modePrompts ?? current.modePrompts,
    promptControls: behavior.promptControls ?? current.promptControls,
    capabilities: behavior.capabilities ?? current.capabilities,
    conversationHistoryEnabled: typeof behavior.conversationHistoryEnabled === "boolean"
      ? behavior.conversationHistoryEnabled
      : current.conversationHistoryEnabled,
    conversationRetentionDays: typeof behavior.conversationRetentionDays === "number"
      ? behavior.conversationRetentionDays
      : current.conversationRetentionDays,
    maxConversationsPerVisitor: typeof behavior.maxConversationsPerVisitor === "number"
      ? behavior.maxConversationsPerVisitor
      : current.maxConversationsPerVisitor,
    dailyLimit: typeof behavior.dailyLimit === "number" ? behavior.dailyLimit : current.dailyLimit,
    maxMessageLength: typeof behavior.maxMessageLength === "number" ? behavior.maxMessageLength : current.maxMessageLength,
    maxHistoryMessages: typeof behavior.maxHistoryMessages === "number" ? behavior.maxHistoryMessages : current.maxHistoryMessages,
    maxOutputTokens: typeof behavior.maxOutputTokens === "number" ? behavior.maxOutputTokens : current.maxOutputTokens,
    temperature: typeof behavior.temperature === "number" ? behavior.temperature : current.temperature,
    uploadEnabled: typeof behavior.uploadEnabled === "boolean" ? behavior.uploadEnabled : current.uploadEnabled,
    uploadWindowDays: typeof behavior.uploadWindowDays === "number"
      ? behavior.uploadWindowDays
      : current.uploadWindowDays,
    uploadLimitPerWindow: typeof behavior.uploadLimitPerWindow === "number"
      ? behavior.uploadLimitPerWindow
      : current.uploadLimitPerWindow,
    uploadTokenTtlMinutes: typeof behavior.uploadTokenTtlMinutes === "number"
      ? behavior.uploadTokenTtlMinutes
      : current.uploadTokenTtlMinutes,
    contextBudgetTokens: typeof behavior.contextBudgetTokens === "number"
      ? behavior.contextBudgetTokens
      : current.contextBudgetTokens,
    contextVerbatimMessages: typeof behavior.contextVerbatimMessages === "number"
      ? behavior.contextVerbatimMessages
      : current.contextVerbatimMessages,
  });
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, value: merged, updatedAt: new Date() } },
    { upsert: true }
  );
  return merged;
}
