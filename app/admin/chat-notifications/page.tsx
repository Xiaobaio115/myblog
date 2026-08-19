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
type AiBehavior = {
  systemPrompt: string;
  knowledgeText: string;
  mode: AiMode;
  enabledModes: AiMode[];
  modeLabels: Record<AiMode, string>;
  modePrompts: Record<AiMode, string>;
  capabilities: AiCapabilities;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<SettingsSummary>("/api/chat-notification-settings", {
        fallbackError: "读取聊天通知配置失败。",
      });
      setSummary(data);
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
              configured={summary?.aiConfigured || false}
              source={summary?.aiSource || "none"}
            />
          </div>
          {summary?.aiBaseHost || summary?.aiModel ? (
            <div className={styles.host}>
              当前连接：{summary.aiBaseHost || "接口未完整配置"}
              {summary.aiModel ? ` / ${summary.aiModel}` : ""}
            </div>
          ) : null}
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
            配置访客可切换的回答模式、站内查询能力、角色说明和使用限制。保存后立即作用于右下角对话。
          </p>
          {aiBehavior ? (
            <div className={styles.behaviorGrid}>
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
                <span>系统提示词</span>
                <textarea
                  className="admin-input"
                  rows={8}
                  value={aiBehavior.systemPrompt}
                  onChange={(event) => setAiBehavior({ ...aiBehavior, systemPrompt: event.target.value })}
                />
                <small>描述身份、语气、知识范围和回答方式。不要在这里填写 API Key。</small>
              </label>
              <label className={styles.field}>
                <span>AI 知识补充文本</span>
                <textarea
                  className="admin-input"
                  rows={7}
                  value={aiBehavior.knowledgeText}
                  onChange={(event) => setAiBehavior({ ...aiBehavior, knowledgeText: event.target.value })}
                  placeholder="补充博客模块、作者偏好、常用术语等稳定知识。模型会把它作为参考，不会替代实时检索结果。"
                />
                <small>这里写给 AI 看的背景资料，不要放 API Key、密码或访客隐私。</small>
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
                      </label>
                    </div>
                  ))}
                </div>
              </div>
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
