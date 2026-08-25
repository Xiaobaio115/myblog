"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import {
  CONVERSATION_GROUPS,
  CONVERSATION_GROUP_LABELS,
  DEFAULT_CONVERSATION_GROUP,
  type ConversationGroup,
} from "@/lib/ai-conversation-groups";
import { renderAssistantMarkdown } from "@/lib/assistant-markdown";
import styles from "./page.module.css";

type AiMode = "guide" | "companion" | "technical" | "writer";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  reasoning?: string;
  errored?: boolean;
  truncated?: boolean;
};

/**
 * 两组会话的字段并不相同，所以用可选字段的联合形状而不是硬凑成一致：
 * 访客会话有 visitorLabel / mode / expiresAt（受 TTL 约束），
 * 开发者会话有 modelId / instructions（永久保存）。
 * 强行统一会把「这条会话什么时候过期」「用的哪个模型」这些真正有用的信息抹掉。
 */
type ConversationSummary = {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  mode?: AiMode | "technical";
  visitorLabel?: string;
  modelId?: string;
  instructions?: string;
};

type ConversationDetail = ConversationSummary & { messages: ChatMessage[] };

type ConversationListResponse = {
  storageAvailable: boolean;
  group: ConversationGroup;
  counts: Record<ConversationGroup, number>;
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

/** 模式标签。开发者会话固定是 technical，且历史数据里可能压根没有这个字段。 */
function describeMode(mode: ConversationSummary["mode"]) {
  return mode && mode in MODE_LABELS ? MODE_LABELS[mode as AiMode] : "未标注";
}

/**
 * 归属说明。
 * 访客用 visitorHash 前 10 位做标签——够区分不同访客，又不泄露完整哈希；
 * 开发者会话只有管理员一个人，没有可分辨的身份，直接标明来源。
 */
function describeOwner(group: ConversationGroup, conversation: ConversationSummary) {
  if (group === "developer") {
    return conversation.modelId ? `模型 ${conversation.modelId}` : "后台 AI 页";
  }
  return `访客 ${conversation.visitorLabel || "未知"}`;
}

export default function AdminAiConversationsPage() {
  const [group, setGroup] = useState<ConversationGroup>(DEFAULT_CONVERSATION_GROUP);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  /** 两组的条数都留着：切换器上要直接显示，不用切过去才知道另一组有多少 */
  const [counts, setCounts] = useState<Record<ConversationGroup, number>>({ visitor: 0, developer: 0 });
  const [policy, setPolicy] = useState<ConversationListResponse["policy"] | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (target: ConversationGroup) => {
    setLoading(true);
    setMessage("");
    try {
      const data = await adminFetch<ConversationListResponse>(
        `/api/ai-conversations/admin?group=${encodeURIComponent(target)}`,
        { fallbackError: "读取 AI 会话失败。" }
      );
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setCounts({
        visitor: Number(data.counts?.visitor || 0),
        developer: Number(data.counts?.developer || 0),
      });
      setPolicy(data.policy);
      setStorageAvailable(data.storageAvailable !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取 AI 会话失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load(group)); }, [load, group]);

  /**
   * 切换分组。必须清掉已选中的会话：
   * 详情是按 id + 分组去查的，留着上一组的选中项会导致换组后详情区读不到内容。
   */
  function switchGroup(next: ConversationGroup) {
    if (next === group) return;
    setSelected(null);
    setGroup(next);
  }

  async function openConversation(id: string) {
    setDetailLoading(true);
    setMessage("");
    try {
      const data = await adminFetch<{ conversation: ConversationDetail }>(
        `/api/ai-conversations/admin?group=${encodeURIComponent(group)}&id=${encodeURIComponent(id)}`,
        { fallbackError: "读取会话内容失败。" }
      );
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
        json: { group, id },
        fallbackError: "删除 AI 会话失败。",
      });
      setConversations((current) => current.filter((item) => item.id !== id));
      setCounts((current) => ({ ...current, [group]: Math.max(0, current[group] - 1) }));
      if (selected?.id === id) setSelected(null);
      setMessage("会话已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除 AI 会话失败。");
    } finally {
      setBusyId("");
    }
  }

  async function clearAll() {
    const groupLabel = CONVERSATION_GROUP_LABELS[group];
    // 确认文案里必须点名分组和条数：现在有两组会话，
    // 只说「清空全部 AI 会话」会让人不知道清的是哪一组，而这一步不可逆。
    if (!counts[group] || !window.confirm(
      `确定清空「${groupLabel}」的 ${counts[group]} 条 AI 会话吗？另一组不受影响，此操作无法恢复。`
    )) return;
    setBusyId("all");
    try {
      await adminFetch("/api/ai-conversations/admin", {
        method: "DELETE",
        json: { group, all: true },
        fallbackError: "清空 AI 会话失败。",
      });
      setConversations([]);
      setSelected(null);
      setCounts((current) => ({ ...current, [group]: 0 }));
      setMessage(`「${groupLabel}」的会话已清空。`);
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
          <p>按归属分组查看 AI 对话并分别清理：前台访客会话受保留天数限制，后台开发者会话永久保存。</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className="secondary-link" onClick={() => void load(group)} disabled={loading}>
            {loading ? "读取中..." : "刷新"}
          </button>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => void clearAll()}
            disabled={!counts[group] || busyId === "all"}
          >
            {busyId === "all" ? "清理中..." : `清空${CONVERSATION_GROUP_LABELS[group]}`}
          </button>
        </div>
      </div>

      {message ? <div className={styles.message} role="status">{message}</div> : null}

      {/*
        用 tablist 而不是两个普通按钮：这是在同一块区域里切换数据源，
        读屏软件需要知道「当前选中哪一组」，aria-selected 才能表达出来。
      */}
      <div className={styles.groupTabs} role="tablist" aria-label="会话归属分组">
        {CONVERSATION_GROUPS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={group === item}
            className={group === item ? styles.groupTabActive : ""}
            onClick={() => switchGroup(item)}
            disabled={loading}
          >
            {CONVERSATION_GROUP_LABELS[item]}
            <b>{counts[item]}</b>
          </button>
        ))}
      </div>

      <section className={styles.summary} aria-label="会话存储状态">
        <div><span>本组记录</span><strong>{counts[group]}</strong></div>
        {/*
          保留策略和每访客上限只对访客组成立。开发者会话永久保存、不限条数，
          在开发者视图下照搬这两个数字等于显示假信息。
        */}
        {group === "visitor" ? (
          <>
            <div><span>自动保留</span><strong>{policy?.retentionDays || 0} 天</strong></div>
            <div><span>每访客上限</span><strong>{policy?.maxPerVisitor || 0} 条</strong></div>
          </>
        ) : (
          <>
            <div><span>自动保留</span><strong>永久</strong></div>
            <div><span>条数上限</span><strong>不限</strong></div>
          </>
        )}
        {/*
          conversationHistoryEnabled 是前台访客历史的开关，管不到开发者会话——
          后者只要数据库连着就一直存。所以开发者视图下不能照抄这个开关的状态。
        */}
        <div>
          <span>保存状态</span>
          <strong>
            {!storageAvailable
              ? "数据库未连接"
              : group === "developer"
                ? "已开启"
                : policy?.enabled ? "已开启" : "已关闭"}
          </strong>
        </div>
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
                  <span>{describeMode(conversation.mode)} · {conversation.messageCount} 条消息</span>
                  <small>{formatDate(conversation.updatedAt)} · {describeOwner(group, conversation)}</small>
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
                <div>
                  <h2>{selected.title}</h2>
                  <p>{describeOwner(group, selected)} · {formatDate(selected.createdAt)} · {describeMode(selected.mode)}</p>
                </div>
                <button type="button" onClick={() => void deleteConversation(selected.id)} disabled={busyId === selected.id}>删除会话</button>
              </div>
              {/* 自定义指令只有开发者会话才有，它决定了模型当时的行为，排查回答异常时要能看到 */}
              {selected.instructions ? (
                <details className={styles.detailInstructions}>
                  <summary>自定义指令</summary>
                  <p>{selected.instructions}</p>
                </details>
              ) : null}
              <div className={styles.messages}>
                {selected.messages.map((item) => (
                  <article className={item.role === "user" ? styles.user : styles.assistant} key={item.id}>
                    <div>
                      <strong>
                        {item.role === "user"
                          ? (group === "developer" ? "我" : "访客")
                          : (group === "developer" ? "模型" : "甘蔗 AI")}
                      </strong>
                      {/*
                        标出错误与截断：这两种消息的正文看起来和正常回答没区别
                        （错误提示就是一句话），不标的话排查时会把「服务不可用」
                        当成模型真的这么回答了。
                      */}
                      {item.errored ? <em className={styles.messageFlag}>失败</em> : null}
                      {item.truncated ? <em className={styles.messageFlag}>被截断</em> : null}
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
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
