"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { renderAssistantMarkdown } from "@/lib/assistant-markdown";
import styles from "./page.module.css";

type AiMode = "guide" | "companion" | "technical" | "writer";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  mode: AiMode;
  visitorLabel: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type ConversationDetail = ConversationSummary & { messages: ChatMessage[] };

type ConversationListResponse = {
  count: number;
  storageAvailable: boolean;
  conversations: ConversationSummary[];
  policy: { enabled: boolean; retentionDays: number; maxPerVisitor: number };
};

const MODE_LABELS: Record<AiMode, string> = {
  guide: "导览",
  companion: "聊天",
  technical: "技术",
  writer: "写作",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN");
}

export default function AdminAiConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [count, setCount] = useState(0);
  const [policy, setPolicy] = useState<ConversationListResponse["policy"] | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await adminFetch<ConversationListResponse>("/api/ai-conversations/admin", {
        fallbackError: "读取 AI 会话失败。",
      });
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setCount(Number(data.count || 0));
      setPolicy(data.policy);
      setStorageAvailable(data.storageAvailable !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取 AI 会话失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function openConversation(id: string) {
    setDetailLoading(true);
    setMessage("");
    try {
      const data = await adminFetch<{ conversation: ConversationDetail }>(`/api/ai-conversations/admin?id=${encodeURIComponent(id)}`, {
        fallbackError: "读取会话内容失败。",
      });
      setSelected(data.conversation);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取会话内容失败。");
    } finally {
      setDetailLoading(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("确定删除这条 AI 会话吗？删除后无法恢复。")) return;
    setBusyId(id);
    try {
      await adminFetch("/api/ai-conversations/admin", {
        method: "DELETE",
        json: { id },
        fallbackError: "删除 AI 会话失败。",
      });
      setConversations((current) => current.filter((item) => item.id !== id));
      setCount((current) => Math.max(0, current - 1));
      if (selected?.id === id) setSelected(null);
      setMessage("会话已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除 AI 会话失败。");
    } finally {
      setBusyId("");
    }
  }

  async function clearAll() {
    if (!count || !window.confirm(`确定清空数据库中的 ${count} 条 AI 会话吗？此操作无法恢复。`)) return;
    setBusyId("all");
    try {
      await adminFetch("/api/ai-conversations/admin", {
        method: "DELETE",
        json: { all: true },
        fallbackError: "清空 AI 会话失败。",
      });
      setConversations([]);
      setSelected(null);
      setCount(0);
      setMessage("全部 AI 会话已清空。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空 AI 会话失败。");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className={`admin-dashboard ${styles.page}`}>
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">AI CONVERSATIONS</div>
          <h1>AI 会话</h1>
          <p>查看匿名访客在独立 AI 页保存的对话，并清理不再需要的记录。</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className="secondary-link" onClick={() => void load()} disabled={loading}>
            {loading ? "读取中..." : "刷新"}
          </button>
          <button type="button" className={styles.clearButton} onClick={() => void clearAll()} disabled={!count || busyId === "all"}>
            {busyId === "all" ? "清理中..." : "清空全部"}
          </button>
        </div>
      </div>

      {message ? <div className={styles.message} role="status">{message}</div> : null}

      <section className={styles.summary} aria-label="会话存储状态">
        <div><span>当前记录</span><strong>{count}</strong></div>
        <div><span>自动保留</span><strong>{policy?.retentionDays || 0} 天</strong></div>
        <div><span>每访客上限</span><strong>{policy?.maxPerVisitor || 0} 条</strong></div>
        <div><span>保存状态</span><strong>{!storageAvailable ? "数据库未连接" : policy?.enabled ? "已开启" : "已关闭"}</strong></div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.listPane} aria-busy={loading}>
          <div className={styles.paneHead}><h2>最近更新</h2><span>最多显示 100 条</span></div>
          {loading ? <p className={styles.empty}>正在读取会话...</p> : null}
          {!loading && conversations.length === 0 ? <p className={styles.empty}>暂无保存的 AI 会话。</p> : null}
          <div className={styles.list}>
            {conversations.map((conversation) => (
              <div className={`${styles.row} ${selected?.id === conversation.id ? styles.rowActive : ""}`} key={conversation.id}>
                <button type="button" onClick={() => void openConversation(conversation.id)}>
                  <strong>{conversation.title}</strong>
                  <span>{MODE_LABELS[conversation.mode]} · {conversation.messageCount} 条消息</span>
                  <small>{formatDate(conversation.updatedAt)} · 访客 {conversation.visitorLabel}</small>
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={busyId === conversation.id}
                  onClick={() => void deleteConversation(conversation.id)}
                >
                  {busyId === conversation.id ? "..." : "删除"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.detailPane}>
          {detailLoading ? <p className={styles.empty}>正在读取完整内容...</p> : null}
          {!detailLoading && !selected ? (
            <div className={styles.detailEmpty}><strong>选择一条会话</strong><span>完整消息只会在打开后加载。</span></div>
          ) : null}
          {!detailLoading && selected ? (
            <>
              <div className={styles.detailHead}>
                <div><h2>{selected.title}</h2><p>访客 {selected.visitorLabel} · {formatDate(selected.createdAt)} · {MODE_LABELS[selected.mode]}</p></div>
                <button type="button" onClick={() => void deleteConversation(selected.id)} disabled={busyId === selected.id}>删除会话</button>
              </div>
              <div className={styles.messages}>
                {selected.messages.map((item) => (
                  <article className={item.role === "user" ? styles.user : styles.assistant} key={item.id}>
                    <div><strong>{item.role === "user" ? "访客" : "甘蔗 AI"}</strong><span>{formatDate(item.createdAt)}</span></div>
                    {item.role === "assistant" ? (
                      <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(item.content) }} />
                    ) : <p>{item.content}</p>}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
