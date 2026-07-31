import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/mongodb";

const SETTINGS_KEY = "chatNotificationSecrets";

export type ChatNotificationSecrets = {
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  serverChanSendKey: string;
  webhookUrl: string;
  webhookToken: string;
};

type SettingsSource = "environment" | "admin" | "mixed" | "none";

export type ChatNotificationSettingsSummary = {
  aiConfigured: boolean;
  aiSource: SettingsSource;
  aiApiKeyConfigured: boolean;
  aiBaseHost: string;
  aiModel: string;
  serverChanConfigured: boolean;
  serverChanSource: Exclude<SettingsSource, "mixed">;
  webhookConfigured: boolean;
  webhookSource: Exclude<SettingsSource, "mixed">;
  webhookHost: string;
  webhookTokenConfigured: boolean;
};

type EncryptedSettings = {
  version: 1;
  iv: string;
  tag: string;
  value: string;
};

const EMPTY_SETTINGS: ChatNotificationSecrets = {
  aiApiKey: "",
  aiBaseUrl: "",
  aiModel: "",
  serverChanSendKey: "",
  webhookUrl: "",
  webhookToken: "",
};

function getEncryptionKey() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("服务端尚未配置 ADMIN_PASSWORD。");
  }

  return createHash("sha256")
    .update(`lqpp-chat-notification:${adminPassword}`)
    .digest();
}

function encryptSettings(settings: ChatNotificationSecrets): EncryptedSettings {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(settings), "utf8"),
    cipher.final(),
  ]);

  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decryptSettings(payload: EncryptedSettings): ChatNotificationSecrets {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<ChatNotificationSecrets>;

  return {
    aiApiKey: String(parsed.aiApiKey || ""),
    aiBaseUrl: String(parsed.aiBaseUrl || ""),
    aiModel: String(parsed.aiModel || ""),
    serverChanSendKey: String(parsed.serverChanSendKey || ""),
    webhookUrl: String(parsed.webhookUrl || ""),
    webhookToken: String(parsed.webhookToken || ""),
  };
}

async function readStoredSettings() {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY });
    const payload = doc?.value as EncryptedSettings | undefined;
    if (!payload || payload.version !== 1) return { ...EMPTY_SETTINGS };
    return decryptSettings(payload);
  } catch (error) {
    console.error("Unable to read chat notification settings:", error);
    return { ...EMPTY_SETTINGS };
  }
}

export async function getEffectiveChatNotificationSettings() {
  const stored = await readStoredSettings();

  return {
    aiApiKey: process.env.AI_API_KEY?.trim() || stored.aiApiKey,
    aiBaseUrl: process.env.AI_BASE_URL?.trim() || stored.aiBaseUrl,
    aiModel: process.env.AI_MODEL?.trim() || stored.aiModel,
    serverChanSendKey:
      process.env.SERVERCHAN_SEND_KEY?.trim() || stored.serverChanSendKey,
    webhookUrl: process.env.CHAT_WEBHOOK_URL?.trim() || stored.webhookUrl,
    webhookToken:
      process.env.CHAT_WEBHOOK_TOKEN?.trim() || stored.webhookToken,
  };
}

export async function getChatNotificationSettingsSummary(): Promise<ChatNotificationSettingsSummary> {
  const stored = await readStoredSettings();
  const envAi = [
    process.env.AI_API_KEY?.trim(),
    process.env.AI_BASE_URL?.trim(),
    process.env.AI_MODEL?.trim(),
  ];
  const effectiveAi = {
    apiKey: envAi[0] || stored.aiApiKey,
    baseUrl: envAi[1] || stored.aiBaseUrl,
    model: envAi[2] || stored.aiModel,
  };
  const hasEnvAi = envAi.some(Boolean);
  const hasStoredAiContribution = Boolean(
    (!envAi[0] && stored.aiApiKey) ||
      (!envAi[1] && stored.aiBaseUrl) ||
      (!envAi[2] && stored.aiModel),
  );
  const envServerChan = Boolean(process.env.SERVERCHAN_SEND_KEY?.trim());
  const envWebhook = Boolean(process.env.CHAT_WEBHOOK_URL?.trim());
  const effectiveWebhookUrl = process.env.CHAT_WEBHOOK_URL?.trim() || stored.webhookUrl;
  let aiBaseHost = "";
  let webhookHost = "";

  if (effectiveAi.baseUrl) {
    try {
      aiBaseHost = new URL(effectiveAi.baseUrl).host;
    } catch {
      aiBaseHost = "已配置";
    }
  }

  if (effectiveWebhookUrl) {
    try {
      webhookHost = new URL(effectiveWebhookUrl).host;
    } catch {
      webhookHost = "已配置";
    }
  }

  return {
    aiConfigured: Boolean(effectiveAi.apiKey && effectiveAi.baseUrl && effectiveAi.model),
    aiSource: hasEnvAi
      ? hasStoredAiContribution
        ? "mixed"
        : "environment"
      : stored.aiApiKey || stored.aiBaseUrl || stored.aiModel
        ? "admin"
        : "none",
    aiApiKeyConfigured: Boolean(effectiveAi.apiKey),
    aiBaseHost,
    aiModel: effectiveAi.model,
    serverChanConfigured: envServerChan || Boolean(stored.serverChanSendKey),
    serverChanSource: envServerChan
      ? "environment"
      : stored.serverChanSendKey
        ? "admin"
        : "none",
    webhookConfigured: envWebhook || Boolean(stored.webhookUrl),
    webhookSource: envWebhook ? "environment" : stored.webhookUrl ? "admin" : "none",
    webhookHost,
    webhookTokenConfigured: Boolean(
      process.env.CHAT_WEBHOOK_TOKEN?.trim() || stored.webhookToken,
    ),
  };
}

export async function updateChatNotificationSettings(input: {
  aiApiKey?: unknown;
  aiBaseUrl?: unknown;
  aiModel?: unknown;
  serverChanSendKey?: unknown;
  webhookUrl?: unknown;
  webhookToken?: unknown;
  clearAi?: unknown;
  clearServerChan?: unknown;
  clearWebhook?: unknown;
}) {
  const current = await readStoredSettings();
  const next = { ...current };
  const aiApiKey = String(input.aiApiKey || "").trim();
  const aiBaseUrl = String(input.aiBaseUrl || "").trim();
  const aiModel = String(input.aiModel || "").trim();
  const serverChanSendKey = String(input.serverChanSendKey || "").trim();
  const webhookUrl = String(input.webhookUrl || "").trim();
  const webhookToken = String(input.webhookToken || "").trim();

  if (input.clearAi === true) {
    next.aiApiKey = "";
    next.aiBaseUrl = "";
    next.aiModel = "";
  }

  if (aiApiKey) {
    if (aiApiKey.length > 2000) throw new Error("AI API Key 过长。");
    next.aiApiKey = aiApiKey;
  }

  if (aiBaseUrl) {
    const parsed = new URL(aiBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("AI 接口地址只支持 HTTP 或 HTTPS。");
    }
    if (aiBaseUrl.length > 2000) throw new Error("AI 接口地址过长。");
    next.aiBaseUrl = aiBaseUrl.replace(/\/$/, "");
  }

  if (aiModel) {
    if (aiModel.length > 200) throw new Error("AI 模型名称过长。");
    next.aiModel = aiModel;
  }

  if (input.clearServerChan === true) next.serverChanSendKey = "";
  if (serverChanSendKey) {
    if (serverChanSendKey.length > 200) throw new Error("Server酱 SendKey 格式不正确。");
    next.serverChanSendKey = serverChanSendKey;
  }

  if (input.clearWebhook === true) {
    next.webhookUrl = "";
    next.webhookToken = "";
  }

  if (webhookUrl) {
    const parsed = new URL(webhookUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error("Webhook 地址只支持 HTTP 或 HTTPS。");
    }
    if (webhookUrl.length > 2000) throw new Error("Webhook 地址过长。");
    next.webhookUrl = webhookUrl;
  }

  if (webhookToken) {
    if (webhookToken.length > 1000) throw new Error("Webhook Token 过长。");
    next.webhookToken = webhookToken;
  }

  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: SETTINGS_KEY },
    {
      $set: {
        key: SETTINGS_KEY,
        value: encryptSettings(next),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}
