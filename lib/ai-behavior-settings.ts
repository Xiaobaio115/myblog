import "server-only";
import { getDb } from "@/lib/mongodb";

const SETTINGS_KEY = "aiBehavior";

export type AiBehavior = {
  systemPrompt: string;
  dailyLimit: number;
  maxMessageLength: number;
  maxHistoryMessages: number;
  maxOutputTokens: number;
  temperature: number;
};

export const AI_BEHAVIOR_DEFAULTS: AiBehavior = {
  systemPrompt: `你是这个个人博客右下角的虚拟助手，名字叫甘蔗。
你的语气像朋友一样自然、简洁、温和，什么话题都可以聊。
你可以介绍博客的首页、文章、相册、3D 星空相册、我的世界、旅行地图等内容。
回答以中文为主，尽量简短；只有用户明确要求详细说明时才展开。`,
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

function normalizeBehavior(value: Partial<AiBehavior>): AiBehavior {
  const systemPrompt = typeof value.systemPrompt === "string"
    ? value.systemPrompt.trim().slice(0, 8000)
    : "";

  return {
    systemPrompt: systemPrompt || AI_BEHAVIOR_DEFAULTS.systemPrompt,
    dailyLimit: clampNumber(value.dailyLimit, AI_BEHAVIOR_DEFAULTS.dailyLimit, 1, 1000, true),
    maxMessageLength: clampNumber(value.maxMessageLength, AI_BEHAVIOR_DEFAULTS.maxMessageLength, 50, 10000, true),
    maxHistoryMessages: clampNumber(value.maxHistoryMessages, AI_BEHAVIOR_DEFAULTS.maxHistoryMessages, 1, 30, true),
    maxOutputTokens: clampNumber(value.maxOutputTokens, AI_BEHAVIOR_DEFAULTS.maxOutputTokens, 32, 4000, true),
    temperature: clampNumber(value.temperature, AI_BEHAVIOR_DEFAULTS.temperature, 0, 2),
  };
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
