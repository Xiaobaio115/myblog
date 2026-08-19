"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import styles from "./page.module.css";

type AiMode = "guide" | "companion" | "technical" | "writer";
type AiCapabilities = {
  searchArticles: boolean;
  searchPhotos: boolean;
  searchProjects: boolean;
  searchTravel: boolean;
  recommendations: boolean;
  navigation: boolean;
};
type AiPromptControls = {
  useKnowledgeText: boolean;
  useModePrompt: boolean;
  useSiteContext: boolean;
  useFormattingPrompt: boolean;
  useLocalFallbacks: boolean;
};
type AiBehavior = {
  systemPrompt: string;
  knowledgeText: string;
  mode: AiMode;
  enabledModes: AiMode[];
  modeLabels: Record<AiMode, string>;
  modePrompts: Record<AiMode, string>;
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
};

type SettingsSummary = {
  aiConfigured: boolean;
  aiSource: "environment" | "admin" | "mixed" | "none";
  aiApiKeyConfigured: boolean;
  aiBaseHost: string;
  aiModel: string;
  serverChanConfigured: boolean;
  serverChanSource: "environment" | "admin" | "none";
  webhookConfigured: boolean;
  webhookSource: "environment" | "admin" | "none";
  webhookHost: string;
  webhookTokenConfigured: boolean;
};

type AdminAiModel = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
};

type AdminAiProvider = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  apiKeyConfigured: boolean;
  enabled: boolean;
  models: AdminAiModel[];
};

type AdminAiProviderPool = {
  defaultModelId: string;
  usingLegacyFallback: boolean;
  providers: AdminAiProvider[];
};

type FeedbackMessage = {
  text: string;
  tone: "success" | "error";
};

const SOURCE_LABEL = {
  environment: "环境变量",
  admin: "后台保存",
  mixed: "环境变量 + 后台",
  none: "未配置",
} as const;

const AI_MODE_OPTIONS: Array<{ value: AiMode; label: string; note: string }> = [
  { value: "guide", label: "站点导览", note: "优先回答内容位置和入口" },
  { value: "companion", label: "陪伴聊天", note: "更自然地闲聊和回应" },
  { value: "technical", label: "技术助手", note: "解释项目、代码和技术栈" },
  { value: "writer", label: "写作助手", note: "标题、摘要和大纲辅助" },
];

const CAPABILITY_OPTIONS: Array<{ key: keyof AiCapabilities; label: string }> = [
  { key: "searchArticles", label: "查询文章和系列" },
  { key: "searchPhotos", label: "查询照片和相册" },
  { key: "searchProjects", label: "查询项目和技术栈" },
  { key: "searchTravel", label: "查询旅行地图" },
  { key: "recommendations", label: "推荐相关内容" },
  { key: "navigation", label: "显示页面跳转按钮" },
];

const PROMPT_CONTROL_OPTIONS: Array<{ key: keyof AiPromptControls; label: string; note: string }> = [
  { key: "useKnowledgeText", label: "附加知识文本", note: "把下方知识补充发送给模型" },
  { key: "useModePrompt", label: "附加模式指令", note: "叠加当前导览、聊天、技术或写作指令" },
  { key: "useSiteContext", label: "启用站内工具", note: "查询文章、照片、项目、地图并生成跳转" },
  { key: "useFormattingPrompt", label: "附加格式说明", note: "提示模型使用 Markdown、代码块和表情" },
  { key: "useLocalFallbacks", label: "启用固定兜底", note: "模型不可用时返回博客内置回答" },
];

export default function ChatNotificationsAdminPage() {
  const [summary, setSummary] = useState<SettingsSummary | null>(null);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [serverChanSendKey, setServerChanSendKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [clearAi, setClearAi] = useState(false);
  const [clearServerChan, setClearServerChan] = useState(false);
  const [clearWebhook, setClearWebhook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiBehavior, setAiBehavior] = useState<AiBehavior | null>(null);
  const [aiBehaviorLoaded, setAiBehaviorLoaded] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [providerPool, setProviderPool] = useState<AdminAiProviderPool | null>(null);
  const [providerPoolLoaded, setProviderPoolLoaded] = useState(false);
  const [providerPoolSaving, setProviderPoolSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, providerData] = await Promise.all([
        adminFetch<SettingsSummary>("/api/chat-notification-settings", {
          fallbackError: "读取聊天通知配置失败。",
        }),
        adminFetch<AdminAiProviderPool>("/api/ai-providers", {
          fallbackError: "读取 AI 模型池失败。",
        }),
      ]);
      setSummary(settingsData);
      setProviderPool(providerData);
      setProviderPoolLoaded(true);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "读取聊天通知配置失败。",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const loadAiBehavior = useCallback(async () => {
    try {
      const data = await adminFetch<AiBehavior>("/api/ai-behavior", { fallbackError: "读取 AI 行为配置失败。" });
      setAiBehavior(data);
      setAiBehaviorLoaded(true);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "读取 AI 行为配置失败。", tone: "error" });
      setAiBehaviorLoaded(true);
    }
  }, []);

  useEffect(() => { queueMicrotask(loadAiBehavior); }, [loadAiBehavior]);

  async function saveAiBehaviorConfig() {
    if (!aiBehavior) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await adminFetch<{ success: boolean; behavior: AiBehavior }>("/api/ai-behavior", {
        method: "PUT",
        json: aiBehavior,
        fallbackError: "保存 AI 行为配置失败。",
      });
      setAiBehavior(data.behavior);
      setMessage({ text: "AI 行为配置已保存。", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存 AI 行为配置失败。", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function saveProviderPool() {
    if (!providerPool) return;
    setProviderPoolSaving(true);
    setMessage(null);
    try {
      const data = await adminFetch<{ success: boolean; pool: AdminAiProviderPool }>("/api/ai-providers", {
        method: "PUT",
        json: providerPool,
        fallbackError: "保存 AI 模型池失败。",
      });
      setProviderPool(data.pool);
      setMessage({ text: "AI 模型池已保存。", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存 AI 模型池失败。", tone: "error" });
    } finally {
      setProviderPoolSaving(false);
    }
  }

  function updateProvider(providerId: string, update: Partial<AdminAiProvider>) {
    setProviderPool((current) => current ? {
      ...current,
      providers: current.providers.map((provider) => provider.id === providerId ? { ...provider, ...update } : provider),
    } : current);
  }

  function updateProviderModel(providerId: string, modelId: string, update: Partial<AdminAiModel>) {
    setProviderPool((current) => current ? {
      ...current,
      providers: current.providers.map((provider) => provider.id === providerId
        ? { ...provider, models: provider.models.map((model) => model.id === modelId ? { ...model, ...update } : model) }
        : provider),
    } : current);
  }

  function addProvider() {
    const providerId = `provider_${crypto.randomUUID().replace(/-/g, "")}`;
    const modelId = `model_${crypto.randomUUID().replace(/-/g, "")}`;
    setProviderPool((current) => current ? {
      ...current,
      providers: [...current.providers, {
        id: providerId,
        label: "新 API 节点",
        baseUrl: "",
        apiKey: "",
        apiKeyConfigured: false,
        enabled: true,
        models: [{ id: modelId, label: "新模型", model: "", enabled: true, supportsVision: false, supportsReasoning: false }],
      }],
    } : current);
  }

  function removeProvider(providerId: string) {
    setProviderPool((current) => {
      if (!current) return current;
      const providers = current.providers.filter((provider) => provider.id !== providerId);
      const defaultStillExists = providers.some((provider) => provider.models.some((model) => `${provider.id}:${model.id}` === current.defaultModelId));
      return { ...current, providers, defaultModelId: defaultStillExists ? current.defaultModelId : "" };
    });
  }

  function addProviderModel(providerId: string) {
    const modelId = `model_${crypto.randomUUID().replace(/-/g, "")}`;
    setProviderPool((current) => current ? {
      ...current,
      providers: current.providers.map((provider) => provider.id === providerId
        ? { ...provider, models: [...provider.models, { id: modelId, label: "新模型", model: "", enabled: true, supportsVision: false, supportsReasoning: false }] }
        : provider),
    } : current);
  }

  function removeProviderModel(providerId: string, modelId: string) {
    setProviderPool((current) => {
      if (!current) return current;
      const providers = current.providers.map((provider) => provider.id === providerId
        ? { ...provider, models: provider.models.filter((model) => model.id !== modelId) }
        : provider);
      return {
        ...current,
        providers,
        defaultModelId: current.defaultModelId === `${providerId}:${modelId}` ? "" : current.defaultModelId,
      };
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const data = await adminFetch<{ settings: SettingsSummary }>("/api/chat-notification-settings", {
        method: "PUT",
        json: {
          aiApiKey,
          aiBaseUrl,
          aiModel,
          serverChanSendKey,
          webhookUrl,
          webhookToken,
          clearAi,
          clearServerChan,
          clearWebhook,
        },
        fallbackError: "保存聊天通知配置失败。",
      });
      setSummary(data.settings as SettingsSummary);
      setAiApiKey("");
      setAiBaseUrl("");
      setAiModel("");
      setServerChanSendKey("");
      setWebhookUrl("");
      setWebhookToken("");
      setClearAi(false);
      setClearServerChan(false);
      setClearWebhook(false);
      setMessage({ text: "配置已保存。", tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "保存聊天通知配置失败。",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      await adminFetch("/api/chat-notification-settings", {
        method: "POST",
        fallbackError: "测试通知发送失败。",
      });
      setMessage({ text: "测试通知已发送，请检查手机端。", tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "测试通知发送失败。",
        tone: "error",
      });
    } finally {
      setTesting(false);
    }
  }

  async function testAi() {
    setAiTesting(true);
    setMessage(null);
    try {
      const data = await adminFetch<{ ok: boolean; error?: string; errorMessage?: string; model?: string; ms?: number }>("/api/ai-test", {
        fallbackError: "AI 连接测试失败。",
      });
      if (!data.ok) throw new Error(data.error || data.errorMessage || "AI 连接失败");
      setMessage({
        text: `AI 连接正常：${data.model}，响应 ${data.ms} ms。`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "AI 连接测试失败。",
        tone: "error",
      });
    } finally {
      setAiTesting(false);
    }
  }

  return (
    <main className={`admin-dashboard ${styles.page}`}>
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">AI CHAT & NOTIFICATIONS</div>
          <h1>AI 聊天与通知</h1>
          <p>配置右下角 AI 对话服务，并将访客消息单向推送到微信或通用 Webhook。</p>
        </div>
        <button
          type="button"
          className="secondary-link"
          onClick={() => void sendTest()}
          disabled={testing || loading}
        >
          {testing ? "发送中..." : "测试手机通知"}
        </button>
      </div>

      {message ? (
        <div
          className={`${styles.message} ${styles[message.tone]}`}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      <div className={styles.channels} aria-busy={loading}>
        <section className={styles.channel}>
          <div className={styles.channelHead}>
            <div>
              <span className={styles.index}>01</span>
              <h2>AI 对话服务</h2>
            </div>
            <Status
              configured={summary?.aiConfigured || Boolean(providerPool?.providers.some((provider) => provider.enabled && provider.apiKeyConfigured))}
              source={summary?.aiSource || "none"}
            />
          </div>
          {summary?.aiBaseHost || summary?.aiModel ? (
            <div className={styles.host}>
              当前连接：{summary.aiBaseHost || "接口未完整配置"}
              {summary.aiModel ? ` / ${summary.aiModel}` : ""}
            </div>
          ) : null}
          <div className={styles.providerPool}>
            <div className={styles.providerPoolHead}>
              <div>
                <span className={styles.fieldLabel}>多模型 API 池</span>
                <p className={styles.fieldHint}>每个节点可以有自己的 Base URL、Key 和多个模型；前台只显示启用的模型名称，不暴露密钥。</p>
              </div>
              <button type="button" className={styles.inlineTest} onClick={addProvider}>＋ 添加 API 节点</button>
            </div>
            {providerPoolLoaded && providerPool?.usingLegacyFallback ? (
              <p className={styles.providerPoolNote}>当前使用旧版单模型配置作为回退。保存下面的模型池后，聊天会优先使用模型池。</p>
            ) : null}
            {!providerPoolLoaded ? <p className={styles.providerPoolNote}>正在读取模型池...</p> : null}
            {providerPool?.providers.map((provider) => (
              <section className={styles.providerItem} key={provider.id}>
                <div className={styles.providerHead}>
                  <div><strong>{provider.label || "未命名节点"}</strong><small>{provider.apiKeyConfigured ? "Key 已配置" : "Key 未配置"}</small></div>
                  <div className={styles.providerHeadActions}>
                    <label className={styles.compactToggle}><input type="checkbox" checked={provider.enabled} onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })} /><span>启用节点</span></label>
                    <button type="button" className={styles.removeProvider} onClick={() => removeProvider(provider.id)}>删除节点</button>
                  </div>
                </div>
                <div className={styles.providerFields}>
                  <label className={styles.field}><span>节点名称</span><input className="admin-input" value={provider.label} onChange={(event) => updateProvider(provider.id, { label: event.target.value })} placeholder="例如：主力模型接口" /></label>
                  <label className={styles.field}><span>API Base URL</span><input className="admin-input" type="url" value={provider.baseUrl} onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })} placeholder="https://.../v1" /></label>
                  <label className={styles.field}><span>API Key</span><input className="admin-input" type="password" autoComplete="off" value={provider.apiKey || ""} onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })} placeholder={provider.apiKeyConfigured ? "已配置，留空保持不变" : "sk-..."} /></label>
                </div>
                <div className={styles.modelPoolHead}><span className={styles.fieldLabel}>节点模型</span><button type="button" className={styles.addModelButton} onClick={() => addProviderModel(provider.id)}>＋ 添加模型</button></div>
                <div className={styles.modelPool}>
                  {provider.models.map((model) => {
                    const modelRef = `${provider.id}:${model.id}`;
                    return <div className={styles.modelItem} key={model.id}>
                      <label className={styles.field}><span>显示名称</span><input className="admin-input" value={model.label} onChange={(event) => updateProviderModel(provider.id, model.id, { label: event.target.value })} placeholder="例如：GPT-4o" /></label>
                      <label className={styles.field}><span>模型 ID</span><input className="admin-input" value={model.model} onChange={(event) => updateProviderModel(provider.id, model.id, { model: event.target.value })} placeholder="供应商模型名称" /></label>
                      <div className={styles.modelFlags}>
                        <label className={styles.compactToggle}><input type="checkbox" checked={model.enabled} onChange={(event) => updateProviderModel(provider.id, model.id, { enabled: event.target.checked })} /><span>前台可选</span></label>
                        <label className={styles.compactToggle}><input type="checkbox" checked={model.supportsVision} onChange={(event) => updateProviderModel(provider.id, model.id, { supportsVision: event.target.checked })} /><span>支持图片</span></label>
                        <label className={styles.compactToggle}><input type="checkbox" checked={model.supportsReasoning} onChange={(event) => updateProviderModel(provider.id, model.id, { supportsReasoning: event.target.checked })} /><span>支持思考流</span></label>
                        <button type="button" className={styles.removeModel} onClick={() => removeProviderModel(provider.id, model.id)} disabled={provider.models.length === 1}>删除</button>
                      </div>
                      <label className={styles.defaultModel}><input type="radio" name="default-ai-model" checked={providerPool.defaultModelId === modelRef} onChange={() => setProviderPool((current) => current ? { ...current, defaultModelId: modelRef } : current)} /><span>设为默认模型</span></label>
                    </div>;
                  })}
                </div>
              </section>
            ))}
            {providerPoolLoaded && providerPool?.providers.length === 0 ? <p className={styles.providerPoolNote}>还没有模型池配置，点击“添加 API 节点”开始。</p> : null}
            <button type="button" className="admin-button" disabled={providerPoolSaving || !providerPoolLoaded} onClick={() => void saveProviderPool()}>{providerPoolSaving ? "保存模型池中..." : "保存多模型配置"}</button>
          </div>
          <details className={styles.legacySettings}>
            <summary>旧版单模型配置（兼容回退）</summary>
            <p>仅当没有可用的多模型节点时使用。已有环境变量优先级仍然最高。</p>
          <div className={styles.aiFields}>
            <label className={styles.field}>
              <span>API Key</span>
              <input
                className="admin-input"
                type="password"
                autoComplete="off"
                value={aiApiKey}
                placeholder={summary?.aiApiKeyConfigured ? "已配置，留空保持不变" : "sk-..."}
                onChange={(event) => {
                  setAiApiKey(event.target.value);
                  setClearAi(false);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>API Base URL</span>
              <input
                className="admin-input"
                type="url"
                value={aiBaseUrl}
                placeholder={summary?.aiBaseHost ? "已配置，留空保持不变" : "https://.../v1"}
                onChange={(event) => {
                  setAiBaseUrl(event.target.value);
                  setClearAi(false);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>模型</span>
              <input
                className="admin-input"
                type="text"
                value={aiModel}
                placeholder={summary?.aiModel ? `当前：${summary.aiModel}` : "模型名称"}
                onChange={(event) => {
                  setAiModel(event.target.value);
                  setClearAi(false);
                }}
              />
            </label>
          </div>
          <div className={styles.channelActions}>
            <button
              type="button"
              className={`secondary-link ${styles.inlineTest}`}
              disabled={aiTesting || loading || !summary?.aiConfigured}
              onClick={() => void testAi()}
            >
              {aiTesting ? "测试中..." : "测试 AI 连接"}
            </button>
            <button
              type="button"
              className={styles.clearButton}
              disabled={!summary || !["admin", "mixed"].includes(summary.aiSource)}
              onClick={() => {
                setClearAi(true);
                setAiApiKey("");
                setAiBaseUrl("");
                setAiModel("");
              }}
            >
              {clearAi ? "保存后移除" : "移除后台配置"}
            </button>
          </div>
          </details>
        </section>

        <section className={styles.channel}>
          <div className={styles.channelHead}>
            <div>
              <span className={styles.index}>02</span>
              <h2>AI 行为与限制</h2>
            </div>
            <span className={styles.status}>
              <i aria-hidden="true" />
              {aiBehaviorLoaded ? "已读取" : "读取中..."}
            </span>
          </div>
          <p className={styles.channelNote}>
            核心行为指令是应用层最高设置；其他知识、模式和站内工具可以独立叠加或完全关闭。
          </p>
          {aiBehavior ? (
            <div className={styles.behaviorGrid}>
              <label className={styles.field}>
                <span>核心行为指令（应用层最高优先级）</span>
                <textarea
                  className="admin-input"
                  rows={9}
                  maxLength={8000}
                  value={aiBehavior.systemPrompt}
                  onChange={(event) => setAiBehavior({ ...aiBehavior, systemPrompt: event.target.value })}
                  placeholder="直接定义 AI 的身份、语气、回答边界和互动方式；留空则不发送应用层核心指令。"
                />
                <small>保存后会直接作为 system 指令发送。这里不要填写 API Key；模型供应商自身规则仍由供应商决定。</small>
              </label>

              <section className={styles.promptLayers} aria-labelledby="prompt-layers-title">
                <div className={styles.promptLayersHead}>
                  <div>
                    <span className={styles.fieldLabel} id="prompt-layers-title">附加机制</span>
                    <p className={styles.fieldHint}>关闭全部附加机制后，接口只发送上面的核心行为指令和聊天历史。</p>
                  </div>
                  <button
                    type="button"
                    className={styles.coreOnlyButton}
                    onClick={() => setAiBehavior({
                      ...aiBehavior,
                      promptControls: {
                        useKnowledgeText: false,
                        useModePrompt: false,
                        useSiteContext: false,
                        useFormattingPrompt: false,
                        useLocalFallbacks: false,
                      },
                    })}
                  >
                    仅使用核心指令
                  </button>
                </div>
                <div className={styles.promptLayerGrid}>
                  {PROMPT_CONTROL_OPTIONS.map((option) => (
                    <label key={option.key} className={styles.promptLayerOption}>
                      <input
                        type="checkbox"
                        checked={aiBehavior.promptControls[option.key]}
                        onChange={(event) => setAiBehavior({
                          ...aiBehavior,
                          promptControls: {
                            ...aiBehavior.promptControls,
                            [option.key]: event.target.checked,
                          },
                        })}
                      />
                      <span><strong>{option.label}</strong><small>{option.note}</small></span>
                    </label>
                  ))}
                </div>
              </section>

              <div className={styles.behaviorTop}>
                <div className={styles.modeControl}>
                  <label className={styles.field}>
                    <span>默认 AI 模式</span>
                    <select
                      className="admin-input"
                      value={aiBehavior.mode}
                      onChange={(event) => setAiBehavior({ ...aiBehavior, mode: event.target.value as AiMode })}
                    >
                      {AI_MODE_OPTIONS.filter((option) => aiBehavior.enabledModes.includes(option.value)).map((option) => (
                        <option key={option.value} value={option.value}>{aiBehavior.modeLabels[option.value] || option.label} · {option.note}</option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.modeAvailability}>
                    <span className={styles.fieldLabel}>聊天窗口可切换模式</span>
                    {AI_MODE_OPTIONS.map((option) => {
                      const checked = aiBehavior.enabledModes.includes(option.value);
                      return (
                        <label key={option.value} className={styles.capabilityOption}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={checked && aiBehavior.enabledModes.length === 1}
                            onChange={(event) => {
                              const enabledModes = event.target.checked
                                ? [...aiBehavior.enabledModes, option.value]
                                : aiBehavior.enabledModes.filter((mode) => mode !== option.value);
                              setAiBehavior({
                                ...aiBehavior,
                                enabledModes,
                                mode: enabledModes.includes(aiBehavior.mode) ? aiBehavior.mode : enabledModes[0],
                              });
                            }}
                          />
                          <span>{aiBehavior.modeLabels[option.value] || option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.capabilities}>
                  <span className={styles.fieldLabel}>可用能力</span>
                  <div className={styles.capabilityGrid}>
                    {CAPABILITY_OPTIONS.map((option) => (
                      <label key={option.key} className={styles.capabilityOption}>
                        <input
                          type="checkbox"
                          checked={aiBehavior.capabilities[option.key]}
                          onChange={(event) => setAiBehavior({
                            ...aiBehavior,
                            capabilities: {
                              ...aiBehavior.capabilities,
                              [option.key]: event.target.checked,
                            },
                          })}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <label className={styles.field}>
                <span>AI 知识补充文本</span>
                <textarea
                  className="admin-input"
                  rows={7}
                  maxLength={12000}
                  value={aiBehavior.knowledgeText}
                  onChange={(event) => setAiBehavior({ ...aiBehavior, knowledgeText: event.target.value })}
                  placeholder="补充博客模块、作者偏好、常用术语等稳定知识。模型会把它作为参考，不会替代实时检索结果。"
                />
                <small>只有开启“附加知识文本”才会发送；可以保存为空。不要放 API Key、密码或访客隐私。</small>
              </label>
              <div className={styles.modePromptSection}>
                <div>
                  <span className={styles.fieldLabel}>模式名称与专属指令</span>
                  <p className={styles.fieldHint}>名称会显示在前台切换按钮；专属指令只在对应模式下发送给模型。</p>
                </div>
                <div className={styles.modePromptGrid}>
                  {AI_MODE_OPTIONS.map((option) => (
                    <div className={styles.modePromptItem} key={option.value}>
                      <label className={styles.field}>
                        <span>{option.label} · 显示名称</span>
                        <input
                          className="admin-input"
                          type="text"
                          maxLength={40}
                          value={aiBehavior.modeLabels[option.value] || ""}
                          onChange={(event) => setAiBehavior({
                            ...aiBehavior,
                            modeLabels: { ...aiBehavior.modeLabels, [option.value]: event.target.value },
                          })}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>回答指令</span>
                        <textarea
                          className="admin-input"
                          rows={5}
                          maxLength={2400}
                          value={aiBehavior.modePrompts[option.value] || ""}
                          onChange={(event) => setAiBehavior({
                            ...aiBehavior,
                            modePrompts: { ...aiBehavior.modePrompts, [option.value]: event.target.value },
                          })}
                        />
                        <small>可以留空；关闭“附加模式指令”后所有模式都只保留名称，不改变回答行为。</small>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <section className={styles.historySettings} aria-labelledby="history-settings-title">
                <div>
                  <span className={styles.fieldLabel} id="history-settings-title">独立 AI 页会话记录</span>
                  <p className={styles.fieldHint}>只保存访客可见的对话内容；记录到期会由 MongoDB 自动清理，也可以在“AI 会话”后台手动删除。</p>
                </div>
                <label className={styles.historyToggle}>
                  <input
                    type="checkbox"
                    checked={aiBehavior.conversationHistoryEnabled}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, conversationHistoryEnabled: event.target.checked })}
                  />
                  <span><strong>保存匿名会话</strong><small>关闭后 `/ai` 仍可聊天，但刷新页面不会保留记录。</small></span>
                </label>
                <div className={styles.historyLimits}>
                  <label className={styles.field}>
                    <span>自动保留天数</span>
                    <input
                      className="admin-input"
                      type="number"
                      min={1}
                      max={365}
                      disabled={!aiBehavior.conversationHistoryEnabled}
                      value={aiBehavior.conversationRetentionDays}
                      onChange={(event) => setAiBehavior({ ...aiBehavior, conversationRetentionDays: Number(event.target.value) })}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>每位访客最多会话</span>
                    <input
                      className="admin-input"
                      type="number"
                      min={1}
                      max={50}
                      disabled={!aiBehavior.conversationHistoryEnabled}
                      value={aiBehavior.maxConversationsPerVisitor}
                      onChange={(event) => setAiBehavior({ ...aiBehavior, maxConversationsPerVisitor: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </section>
              <div className={styles.aiFields}>
                <label className={styles.field}>
                  <span>每日每 IP 次数</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={1}
                    max={1000}
                    value={aiBehavior.dailyLimit}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, dailyLimit: Number(event.target.value) })}
                  />
                </label>
                <label className={styles.field}>
                  <span>单条消息上限</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={50}
                    max={10000}
                    value={aiBehavior.maxMessageLength}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, maxMessageLength: Number(event.target.value) })}
                  />
                </label>
                <label className={styles.field}>
                  <span>保留历史消息</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={1}
                    max={30}
                    value={aiBehavior.maxHistoryMessages}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, maxHistoryMessages: Number(event.target.value) })}
                  />
                </label>
                <label className={styles.field}>
                  <span>最大输出 tokens</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={32}
                    max={4000}
                    value={aiBehavior.maxOutputTokens}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, maxOutputTokens: Number(event.target.value) })}
                  />
                </label>
                <label className={styles.field}>
                  <span>创造性 temperature</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={aiBehavior.temperature}
                    onChange={(event) => setAiBehavior({ ...aiBehavior, temperature: Number(event.target.value) })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="admin-button"
                disabled={saving || !aiBehaviorLoaded}
                onClick={() => void saveAiBehaviorConfig()}
              >
                {saving ? "保存中..." : "保存 AI 行为"}
              </button>
            </div>
          ) : (
            <p className={styles.channelNote}>正在读取 AI 行为配置...</p>
          )}
        </section>

        <section className={styles.channel}>
          <div className={styles.channelHead}>
            <div>
              <span className={styles.index}>03</span>
              <h2>Server酱 · 微信通知</h2>
            </div>
            <Status
              configured={summary?.serverChanConfigured || false}
              source={summary?.serverChanSource || "none"}
            />
          </div>
          <p className={styles.channelNote}>访客消息会推送到微信；微信内回复不会回传到网页。</p>
          <label className={styles.field}>
            <span>SendKey</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="off"
              value={serverChanSendKey}
              disabled={summary?.serverChanSource === "environment"}
              placeholder={summary?.serverChanConfigured ? "已配置，留空保持不变" : "SCT..."}
              onChange={(event) => {
                setServerChanSendKey(event.target.value);
                setClearServerChan(false);
              }}
            />
          </label>
          <button
            type="button"
            className={styles.clearButton}
            disabled={summary?.serverChanSource !== "admin"}
            onClick={() => {
              setClearServerChan(true);
              setServerChanSendKey("");
            }}
          >
            {clearServerChan ? "保存后移除" : "移除后台配置"}
          </button>
        </section>

        <section className={styles.channel}>
          <div className={styles.channelHead}>
            <div>
              <span className={styles.index}>04</span>
              <h2>通用 Webhook · 单向转发</h2>
            </div>
            <Status
              configured={summary?.webhookConfigured || false}
              source={summary?.webhookSource || "none"}
            />
          </div>
          <p className={styles.channelNote}>用于自动化平台或机器人网关；若需要双向回复，接收端还必须提供回调与会话服务。</p>
          {summary?.webhookHost ? (
            <div className={styles.host}>当前目标：{summary.webhookHost}</div>
          ) : null}
          <div className={styles.webhookFields}>
            <label className={styles.field}>
              <span>Webhook URL</span>
              <input
                className="admin-input"
                type="url"
                value={webhookUrl}
                disabled={summary?.webhookSource === "environment"}
                placeholder={summary?.webhookConfigured ? "已配置，留空保持不变" : "https://..."}
                onChange={(event) => {
                  setWebhookUrl(event.target.value);
                  setClearWebhook(false);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>Bearer Token（可选）</span>
              <input
                className="admin-input"
                type="password"
                autoComplete="off"
                value={webhookToken}
                disabled={summary?.webhookSource === "environment"}
                placeholder={summary?.webhookTokenConfigured ? "已配置，留空保持不变" : "可留空"}
                onChange={(event) => {
                  setWebhookToken(event.target.value);
                  setClearWebhook(false);
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className={styles.clearButton}
            disabled={summary?.webhookSource !== "admin"}
            onClick={() => {
              setClearWebhook(true);
              setWebhookUrl("");
              setWebhookToken("");
            }}
          >
            {clearWebhook ? "保存后移除" : "移除后台配置"}
          </button>
        </section>
      </div>

      <div className={styles.footerActions}>
        <button
          type="button"
          className="admin-button"
          disabled={saving || loading}
          onClick={() => void save()}
        >
          {saving ? "保存中..." : "保存聊天配置"}
        </button>
        <span>密钥只保存在服务端，后台不会回显原值；环境变量配置优先。</span>
      </div>
    </main>
  );
}

function Status({
  configured,
  source,
}: {
  configured: boolean;
  source: SettingsSummary["aiSource"];
}) {
  return (
    <span className={`${styles.status} ${configured ? styles.active : ""}`}>
      <i aria-hidden="true" />
      {SOURCE_LABEL[source]}
    </span>
  );
}
