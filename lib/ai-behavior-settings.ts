import "server-only";
import { getDb } from "@/lib/mongodb";

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
  capabilities: AiCapabilities;
  dailyLimit: number;
  maxMessageLength: number;
  maxHistoryMessages: number;
  maxOutputTokens: number;
  temperature: number;
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
  systemPrompt: `你是这个个人博客右下角的虚拟助手，名字叫甘蔗。
你的语气像朋友一样自然、简洁、温和，什么话题都可以聊。
你可以介绍博客的首页、文章、相册、3D 星空相册、我的世界、旅行地图等内容。
  回答以中文为主，尽量简短；只有用户明确要求详细说明时才展开。`,
  knowledgeText: `这是 LQPP 的个人博客。公开模块包括首页、文章与系列、普通照片墙、3D 星空相册、项目页、旅行地图和留言板。
站内检索到的文章、照片、项目和旅行地点才是最新事实；不确定的内容要明确说明，不要编造。`,
  mode: "guide",
  enabledModes: ["guide", "companion", "technical", "writer"],
  modeLabels: { ...AI_MODE_LABEL_DEFAULTS },
  modePrompts: { ...AI_MODE_PROMPT_DEFAULTS },
  capabilities: {
    searchArticles: true,
    searchPhotos: true,
    searchProjects: true,
    searchTravel: true,
    recommendations: true,
    navigation: true,
  },
  dailyLimit: 20,
  maxMessageLength: 500,
  maxHistoryMessages: 6,
  maxOutputTokens: 300,
  temperature: 0.7,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number, integer = false) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(max, Math.max(min, numeric));
  return integer ? Math.round(bounded) : bounded;
}

function normalizeModeText(value: unknown, defaults: AiModeText, maxLength: number): AiModeText {
  const source = value && typeof value === "object"
    ? value as Partial<Record<AiMode, unknown>>
    : {};

  return Object.fromEntries(
    AI_MODES.map((mode) => {
      const text = typeof source[mode] === "string"
        ? source[mode].trim().slice(0, maxLength)
        : "";
      return [mode, text || defaults[mode]];
    })
  ) as AiModeText;
}

function normalizeBehavior(value: Partial<AiBehavior>): AiBehavior {
  const systemPrompt = typeof value.systemPrompt === "string"
    ? value.systemPrompt.trim().slice(0, 8000)
    : "";
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
    systemPrompt: systemPrompt || AI_BEHAVIOR_DEFAULTS.systemPrompt,
    knowledgeText,
    mode,
    enabledModes: enabledModes.length > 0 ? enabledModes : [AI_BEHAVIOR_DEFAULTS.mode],
    modeLabels: normalizeModeText(value.modeLabels, AI_MODE_LABEL_DEFAULTS, 40),
    modePrompts: normalizeModeText(value.modePrompts, AI_MODE_PROMPT_DEFAULTS, 2400),
    capabilities: {
      searchArticles: typeof storedCapabilities.searchArticles === "boolean" ? storedCapabilities.searchArticles : AI_BEHAVIOR_DEFAULTS.capabilities.searchArticles,
      searchPhotos: typeof storedCapabilities.searchPhotos === "boolean" ? storedCapabilities.searchPhotos : AI_BEHAVIOR_DEFAULTS.capabilities.searchPhotos,
      searchProjects: typeof storedCapabilities.searchProjects === "boolean" ? storedCapabilities.searchProjects : AI_BEHAVIOR_DEFAULTS.capabilities.searchProjects,
      searchTravel: typeof storedCapabilities.searchTravel === "boolean" ? storedCapabilities.searchTravel : AI_BEHAVIOR_DEFAULTS.capabilities.searchTravel,
      recommendations: typeof storedCapabilities.recommendations === "boolean" ? storedCapabilities.recommendations : AI_BEHAVIOR_DEFAULTS.capabilities.recommendations,
      navigation: typeof storedCapabilities.navigation === "boolean" ? storedCapabilities.navigation : AI_BEHAVIOR_DEFAULTS.capabilities.navigation,
    },
    dailyLimit: clampNumber(value.dailyLimit, AI_BEHAVIOR_DEFAULTS.dailyLimit, 1, 1000, true),
    maxMessageLength: clampNumber(value.maxMessageLength, AI_BEHAVIOR_DEFAULTS.maxMessageLength, 50, 10000, true),
    maxHistoryMessages: clampNumber(value.maxHistoryMessages, AI_BEHAVIOR_DEFAULTS.maxHistoryMessages, 1, 30, true),
    maxOutputTokens: clampNumber(value.maxOutputTokens, AI_BEHAVIOR_DEFAULTS.maxOutputTokens, 32, 4000, true),
    temperature: clampNumber(value.temperature, AI_BEHAVIOR_DEFAULTS.temperature, 0, 2),
  };
}

export function getAiModePrompt(mode: AiMode, prompts: AiModeText = AI_MODE_PROMPT_DEFAULTS) {
  return prompts[mode] || AI_MODE_PROMPT_DEFAULTS[mode] || AI_MODE_PROMPT_DEFAULTS.guide;
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
    capabilities: behavior.capabilities ?? current.capabilities,
    dailyLimit: typeof behavior.dailyLimit === "number" ? behavior.dailyLimit : current.dailyLimit,
    maxMessageLength: typeof behavior.maxMessageLength === "number" ? behavior.maxMessageLength : current.maxMessageLength,
    maxHistoryMessages: typeof behavior.maxHistoryMessages === "number" ? behavior.maxHistoryMessages : current.maxHistoryMessages,
    maxOutputTokens: typeof behavior.maxOutputTokens === "number" ? behavior.maxOutputTokens : current.maxOutputTokens,
    temperature: typeof behavior.temperature === "number" ? behavior.temperature : current.temperature,
  });
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, value: merged, updatedAt: new Date() } },
    { upsert: true }
  );
  return merged;
}
