import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/mongodb";
import { getEffectiveChatNotificationSettings } from "@/lib/chat-notification-settings";

const SETTINGS_KEY = "aiProviderPool";
const MAX_PROVIDERS = 12;
const MAX_MODELS_PER_PROVIDER = 30;

export type AiProviderModel = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  /**
   * 能否生成图片。
   *
   * 和 supportsVision 是两件事：后者说的是「能看图」（输入），这一项说的是「能画图」（输出）。
   * 之所以要单独开关而不是自动探测：请求体里要不要带 modalities 只能事先决定，
   * 而对不支持的模型带上它，多数供应商会直接报 400 把整轮对话打断。
   */
  supportsImageOutput: boolean;
};

export type AiProvider = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  models: AiProviderModel[];
};

export type AiProviderPool = {
  defaultModelId: string;
  providers: AiProvider[];
};

export type PublicAiModel = {
  id: string;
  label: string;
  providerLabel: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsImageOutput: boolean;
};

export type ResolvedAiModel = PublicAiModel & {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type AdminAiProvider = Omit<AiProvider, "apiKey"> & {
  apiKeyConfigured: boolean;
};

type EncryptedPool = {
  version: 1;
  iv: string;
  tag: string;
  value: string;
};

function getEncryptionKey() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("服务端尚未配置 ADMIN_PASSWORD。");
  return createHash("sha256").update(`lqpp-ai-provider-pool:${adminPassword}`).digest();
}

function encryptPool(pool: AiProviderPool): EncryptedPool {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(pool), "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decryptPool(payload: EncryptedPool): AiProviderPool {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final(),
  ]);
  return normalizePool(JSON.parse(decrypted.toString("utf8")));
}

function cleanId(value: unknown, prefix: string) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,80}$/.test(id) ? id : `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeBaseUrl(value: unknown) {
  const baseUrl = String(value || "").trim().replace(/\/$/, "").slice(0, 2000);
  if (!baseUrl) return "";
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("AI 接口地址只支持 HTTP 或 HTTPS。");
  return baseUrl;
}

function normalizeModel(value: Partial<AiProviderModel>): AiProviderModel | null {
  const model = cleanText(value.model, 200);
  if (!model) return null;
  return {
    id: cleanId(value.id, "model"),
    label: cleanText(value.label, 80) || model,
    model,
    enabled: value.enabled !== false,
    supportsVision: value.supportsVision === true,
    supportsReasoning: value.supportsReasoning === true,
    supportsImageOutput: value.supportsImageOutput === true,
  };
}

type ProviderInput = Omit<Partial<AiProvider>, "models"> & { models?: Array<Partial<AiProviderModel>> };

function normalizeProvider(value: ProviderInput): AiProvider | null {
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const models = Array.isArray(value.models)
    ? value.models.slice(0, MAX_MODELS_PER_PROVIDER).flatMap((item) => {
        const model = normalizeModel(item || {});
        return model ? [model] : [];
      })
    : [];
  if (!baseUrl || models.length === 0) return null;
  return {
    id: cleanId(value.id, "provider"),
    label: cleanText(value.label, 80) || new URL(baseUrl).host,
    baseUrl,
    apiKey: String(value.apiKey || "").trim().slice(0, 4000),
    enabled: value.enabled !== false,
    models,
  };
}

function modelRef(providerId: string, modelId: string) {
  return `${providerId}:${modelId}`;
}

function normalizePool(value: Partial<AiProviderPool>): AiProviderPool {
  const providers = Array.isArray(value.providers)
    ? value.providers.slice(0, MAX_PROVIDERS).flatMap((item) => {
        const provider = normalizeProvider(item || {});
        return provider ? [provider] : [];
      })
    : [];
  const usableIds = new Set(providers.flatMap((provider) => {
    if (!provider.enabled || !provider.apiKey || !provider.baseUrl) return [];
    return provider.models.flatMap((model) => model.enabled ? [modelRef(provider.id, model.id)] : []);
  }));
  const requestedDefault = String(value.defaultModelId || "");
  return {
    providers,
    defaultModelId: usableIds.has(requestedDefault)
      ? requestedDefault
      : usableIds.values().next().value || "",
  };
}

async function readStoredPool(): Promise<AiProviderPool | null> {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY });
    const payload = doc?.value as EncryptedPool | undefined;
    if (!payload || payload.version !== 1) return null;
    return decryptPool(payload);
  } catch (error) {
    console.error("Unable to read AI provider pool:", error);
    return null;
  }
}

async function getLegacyPool(): Promise<AiProviderPool> {
  const legacy = await getEffectiveChatNotificationSettings();
  if (!legacy.aiApiKey || !legacy.aiBaseUrl || !legacy.aiModel) {
    return { defaultModelId: "", providers: [] };
  }
  const providerId = "legacy_provider";
  const modelId = "legacy_model";
  return {
    defaultModelId: modelRef(providerId, modelId),
    providers: [{
      id: providerId,
      label: "默认接口",
      baseUrl: legacy.aiBaseUrl,
      apiKey: legacy.aiApiKey,
      enabled: true,
      models: [{
        id: modelId,
        label: legacy.aiModel,
        model: legacy.aiModel,
        enabled: true,
        supportsVision: false,
        supportsReasoning: false,
        supportsImageOutput: false,
      }],
    }],
  };
}

export async function getEffectiveAiProviderPool() {
  const stored = await readStoredPool();
  return stored && flattenModels(stored).length > 0 ? stored : getLegacyPool();
}

function flattenModels(pool: AiProviderPool): ResolvedAiModel[] {
  return pool.providers.flatMap((provider) => {
    if (!provider.enabled || !provider.apiKey || !provider.baseUrl) return [];
    return provider.models.flatMap((model) => model.enabled ? [{
      id: modelRef(provider.id, model.id),
      label: model.label,
      providerLabel: provider.label,
      supportsVision: model.supportsVision,
      supportsReasoning: model.supportsReasoning,
      supportsImageOutput: model.supportsImageOutput,
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: model.model,
    }] : []);
  });
}

export async function getPublicAiModels() {
  const pool = await getEffectiveAiProviderPool();
  const models = flattenModels(pool);
  const defaultModelId = models.some((model) => model.id === pool.defaultModelId)
    ? pool.defaultModelId
    : models[0]?.id || "";
  return {
    defaultModelId,
    models: models.map((model) => ({
      id: model.id,
      label: model.label,
      providerLabel: model.providerLabel,
      supportsVision: model.supportsVision,
      supportsReasoning: model.supportsReasoning,
      supportsImageOutput: model.supportsImageOutput,
    })),
  };
}

export async function resolveAiModel(requestedId?: string): Promise<ResolvedAiModel | null> {
  const pool = await getEffectiveAiProviderPool();
  const models = flattenModels(pool);
  return models.find((model) => model.id === requestedId)
    || models.find((model) => model.id === pool.defaultModelId)
    || models[0]
    || null;
}

export async function getAdminAiProviderPool() {
  const stored = await readStoredPool();
  const pool = stored || { defaultModelId: "", providers: [] };
  return {
    defaultModelId: pool.defaultModelId,
    usingLegacyFallback: !stored || flattenModels(stored).length === 0,
    providers: pool.providers.map(({ apiKey, ...provider }): AdminAiProvider => ({
      ...provider,
      apiKeyConfigured: Boolean(apiKey),
    })),
  };
}

type IncomingAdminProvider = Omit<Partial<AiProvider>, "models"> & {
  models?: Array<Partial<AiProviderModel>>;
  clearApiKey?: boolean;
};

export async function saveAdminAiProviderPool(input: {
  defaultModelId?: unknown;
  providers?: IncomingAdminProvider[];
}) {
  const current = await readStoredPool();
  const currentById = new Map((current?.providers || []).map((provider) => [provider.id, provider]));
  const incomingProviders = Array.isArray(input.providers) ? input.providers.slice(0, MAX_PROVIDERS) : [];
  const providers = incomingProviders.flatMap((incoming) => {
    const id = cleanId(incoming.id, "provider");
    const previous = currentById.get(id);
    const apiKeyInput = String(incoming.apiKey || "").trim();
    const provider = normalizeProvider({
      ...incoming,
      id,
      apiKey: incoming.clearApiKey === true ? "" : apiKeyInput || previous?.apiKey || "",
    });
    return provider ? [provider] : [];
  });
  if (providers.length === 0) throw new Error("请至少配置一个 API 节点和一个模型。");
  if (providers.some((provider) => provider.enabled && !provider.apiKey)) throw new Error("每个启用的 API 节点都需要配置 Key。");
  const pool = normalizePool({ defaultModelId: String(input.defaultModelId || ""), providers });
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, value: encryptPool(pool), updatedAt: new Date() } },
    { upsert: true }
  );
  return getAdminAiProviderPool();
}

export function createEmptyAdminProvider(): AdminAiProvider {
  return {
    id: `provider_${randomUUID().replace(/-/g, "")}`,
    label: "新 API 节点",
    baseUrl: "",
    enabled: true,
    apiKeyConfigured: false,
    models: [{
      id: `model_${randomUUID().replace(/-/g, "")}`,
      label: "新模型",
      model: "",
      enabled: true,
      supportsVision: false,
      supportsReasoning: false,
      supportsImageOutput: false,
    }],
  };
}
