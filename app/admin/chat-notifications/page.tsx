"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

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
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  const password =
    typeof window === "undefined" ? "" : localStorage.getItem("admin_password") || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat-notification-settings", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取失败");
      setSummary(data as SettingsSummary);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "读取聊天通知配置失败。",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/chat-notification-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          aiApiKey,
          aiBaseUrl,
          aiModel,
          serverChanSendKey,
          webhookUrl,
          webhookToken,
          clearAi,
          clearServerChan,
          clearWebhook,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
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
      const response = await fetch("/api/chat-notification-settings", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发送失败");
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
      const response = await fetch("/api/ai-test", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || data.errorMessage || "AI 连接失败");
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
              <span className={styles.index}>03</span>
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
