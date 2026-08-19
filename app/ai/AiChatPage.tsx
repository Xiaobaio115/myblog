"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { renderAssistantMarkdown } from "@/lib/assistant-markdown";
import { readSseEvents } from "@/lib/ai-sse";
import styles from "./ai-chat.module.css";

type AiMode = "guide" | "companion" | "technical" | "writer";

type ChatAction = {
  label: string;
  href: string;
  kind: "article" | "series" | "photos" | "project" | "travel";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
  reasoning?: string;
  imageNames?: string[];
  imagePreviews?: string[];
  createdAt: string;
};

type PublicAiModel = {
  id: string;
  label: string;
  providerLabel: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
};

type ConversationSummary = {
  id: string;
  title: string;
  mode: AiMode;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type ConversationDetail = ConversationSummary & { messages: ChatMessage[] };

type ChatConfig = {
  defaultMode?: AiMode;
  enabledModes?: AiMode[];
  modes?: Array<{ value: AiMode; label: string }>;
  maxMessageLength?: number;
  defaultModelId?: string;
  models?: PublicAiModel[];
};

type ConversationListResponse = {
  enabled: boolean;
  reason?: "disabled" | "database_unavailable" | "no_history";
  conversations: ConversationSummary[];
  policy?: { retentionDays: number; maxPerVisitor: number };
};

const DEFAULT_MODES: Array<{ value: AiMode; label: string }> = [
  { value: "guide", label: "站点导览" },
  { value: "companion", label: "陪伴聊天" },
  { value: "technical", label: "技术助手" },
  { value: "writer", label: "写作助手" },
];

const STARTER_PROMPTS = [
  "推荐几篇适合现在读的文章",
  "根据博客内容介绍一下作者",
  "带我看看照片和旅行地图",
  "帮我梳理一个技术学习计划",
];

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function toStoredMessages(messages: ChatMessage[]) {
  return messages.map(({ id, role, content, actions, reasoning, imageNames, createdAt }) => ({
    id,
    role,
    content,
    actions,
    reasoning,
    imageNames,
    createdAt,
  }));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export default function AiChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AiMode>("guide");
  const [modeOptions, setModeOptions] = useState(DEFAULT_MODES);
  const [models, setModels] = useState<PublicAiModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [pendingImages, setPendingImages] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [maxMessageLength, setMaxMessageLength] = useState(4000);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [historyReason, setHistoryReason] = useState<ConversationListResponse["reason"]>();
  const [historyLoading, setHistoryLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const requestControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const upsertConversation = useCallback((conversation: ConversationSummary) => {
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const [configResponse, historyResponse] = await Promise.all([
          fetch("/api/chat", { cache: "no-store" }),
          fetch("/api/ai-conversations", { cache: "no-store" }),
        ]);
        const config = configResponse.ok ? await configResponse.json() as ChatConfig : {};
        const configuredModes = Array.isArray(config.modes) && config.modes.length > 0
          ? config.modes
          : DEFAULT_MODES.filter((item) => config.enabledModes?.includes(item.value));
        if (active && configuredModes.length > 0) {
          setModeOptions(configuredModes);
          const initialMode = config.defaultMode && configuredModes.some((item) => item.value === config.defaultMode)
            ? config.defaultMode
            : configuredModes[0].value;
          setMode(initialMode);
        }
        if (active && Number.isFinite(config.maxMessageLength)) {
          setMaxMessageLength(Math.max(50, Number(config.maxMessageLength)));
        }
        if (active && Array.isArray(config.models)) {
          setModels(config.models);
          setModelId(config.defaultModelId && config.models.some((item) => item.id === config.defaultModelId)
            ? config.defaultModelId
            : config.models[0]?.id || "");
        }

        if (historyResponse.ok) {
          const history = await historyResponse.json() as ConversationListResponse;
          if (active) {
            setHistoryEnabled(Boolean(history.enabled));
            setHistoryReason(history.reason);
            setConversations(Array.isArray(history.conversations) ? history.conversations : []);
            setRetentionDays(history.policy?.retentionDays || 30);
          }
        }
      } catch {
        if (active) setNotice("会话记录暂时不可用，但仍可以继续聊天。");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    void loadInitialData();
    return () => {
      active = false;
      requestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => sidebarCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  function handleTranscriptScroll() {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    stickToBottomRef.current = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 140;
  }

  function startNewConversation() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setSending(false);
    setActiveConversationId(null);
    setMessages([]);
    setNotice("");
    setStatusMessage("");
    setPendingImages([]);
    setSidebarOpen(false);
    stickToBottomRef.current = true;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function openConversation(id: string) {
    if (sending || id === activeConversationId) {
      setSidebarOpen(false);
      return;
    }
    setConversationLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/ai-conversations/${id}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
      const conversation = data?.conversation;
      if (!response.ok || !conversation) throw new Error(data?.error || "读取会话失败。");
      setActiveConversationId(conversation.id);
      setMode(modeOptions.some((item) => item.value === conversation.mode)
        ? conversation.mode
        : modeOptions[0]?.value || "guide");
      setMessages(conversation.messages || []);
      upsertConversation(conversation);
      setSidebarOpen(false);
      stickToBottomRef.current = true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取会话失败。");
    } finally {
      setConversationLoading(false);
    }
  }

  async function createStoredConversation(nextMessages: ChatMessage[]) {
    if (!historyEnabled) return null;
    const response = await fetch("/api/ai-conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, messages: toStoredMessages(nextMessages) }),
    });
    const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
    if (!response.ok || !data?.conversation) throw new Error(data?.error || "创建会话记录失败。");
    setActiveConversationId(data.conversation.id);
    upsertConversation(data.conversation);
    return data.conversation.id;
  }

  async function saveStoredConversation(id: string | null, nextMessages: ChatMessage[]) {
    if (!historyEnabled || !id) return;
    const response = await fetch(`/api/ai-conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, messages: toStoredMessages(nextMessages) }),
    });
    const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
    if (!response.ok || !data?.conversation) throw new Error(data?.error || "保存会话记录失败。");
    upsertConversation(data.conversation);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("确定删除这条会话记录吗？删除后无法恢复。")) return;
    try {
      const response = await fetch(`/api/ai-conversations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "删除会话失败。");
      }
      setConversations((current) => current.filter((item) => item.id !== id));
      if (activeConversationId === id) startNewConversation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除会话失败。");
    }
  }

  async function clearConversations() {
    if (!conversations.length || !window.confirm("确定清空你的全部 AI 会话吗？此操作无法恢复。")) return;
    try {
      const response = await fetch("/api/ai-conversations", { method: "DELETE" });
      if (!response.ok) throw new Error("清空会话失败。");
      setConversations([]);
      startNewConversation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "清空会话失败。");
    }
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, 3);
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setNotice("只支持 JPG、PNG、WebP 或 GIF 图片。");
      return;
    }
    if (selected.some((file) => file.size > 4 * 1024 * 1024) || selected.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024) {
      setNotice("最多附加 3 张图片，每张不超过 4MB，总大小不超过 8MB。");
      return;
    }
    const selectedModel = models.find((model) => model.id === modelId);
    if (!selectedModel?.supportsVision) {
      setNotice("请先选择支持图片的模型。");
      return;
    }
    try {
      const dataUrls = await Promise.all(selected.map(readFileAsDataUrl));
      setPendingImages(dataUrls.map((dataUrl, index) => ({ name: selected[index].name, dataUrl })));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取图片失败。");
    }
  }

  const stopResponse = useCallback(() => {
    requestControllerRef.current?.abort();
  }, []);

  async function sendMessage(textFromStarter?: string) {
    const text = (textFromStarter ?? input).trim();
    if (!text || sending || historyLoading) return;
    if (text.length > maxMessageLength) {
      setNotice(`消息请控制在 ${maxMessageLength} 字以内。`);
      return;
    }

    setNotice("");
    setStatusMessage("");
    setInput("");
    setSending(true);
    stickToBottomRef.current = true;
    const userMessage = {
      ...createMessage("user", text),
      imageNames: pendingImages.map((image) => image.name),
      imagePreviews: pendingImages.map((image) => image.dataUrl),
    };
    const assistantMessage = createMessage("assistant", "");
    const requestMessages = [...messages, userMessage];
    const assistantIndex = requestMessages.length;
    let workingMessages = [...requestMessages, assistantMessage];
    let conversationId = activeConversationId;
    setMessages(workingMessages);

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      try {
        if (!conversationId) {
          conversationId = await createStoredConversation(requestMessages);
        } else {
          await saveStoredConversation(conversationId, requestMessages);
        }
      } catch (storageError) {
        setNotice(storageError instanceof Error
          ? `${storageError.message} 本次回答仍会继续。`
          : "会话记录保存失败，本次回答仍会继续。");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages.map(({ role, content }) => ({ role, content })),
          pageUrl: window.location.href,
          mode,
          modelId,
          images: pendingImages.map((image) => image.dataUrl),
          responseFormat: "sse",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "聊天失败，请稍后再试。");
      }
      if (!response.body) throw new Error("当前浏览器不支持流式回答。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullReply = "";
      let fullReasoning = "";
      let actions: ChatAction[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const parsed = readSseEvents(sseBuffer);
        sseBuffer = parsed.remainder;
        for (const event of parsed.events) {
          const data = event.data as { delta?: string; message?: string; actions?: ChatAction[]; url?: string; mode?: AiMode; error?: string };
          if (event.event === "meta") {
            actions = Array.isArray(data.actions) ? data.actions : [];
            if (data.mode && modeOptions.some((item) => item.value === data.mode)) setMode(data.mode);
          }
          if (event.event === "status") setStatusMessage(data.message || "模型正在生成回答");
          if (event.event === "reasoning" && data.delta) {
            fullReasoning += data.delta;
            setStatusMessage("模型正在整理思路");
          }
          if (event.event === "content" && data.delta) {
            fullReply += data.delta;
            setStatusMessage("模型正在生成回答");
          }
          if (event.event === "image" && data.url) fullReply += `\n\n![AI 图片](${data.url})\n\n`;
          if (event.event === "error") throw new Error(data.message || data.error || "聊天服务暂时不可用。");
          workingMessages = workingMessages.map((message, index) => index === assistantIndex
            ? { ...message, content: fullReply, reasoning: fullReasoning, actions }
            : message);
          setMessages(workingMessages);
        }
      }
      fullReply += decoder.decode();
      workingMessages = workingMessages.map((message, index) => index === assistantIndex
        ? { ...message, content: fullReply.trim() ? fullReply : "没有收到有效回复，可以换个问法再试一次。", reasoning: fullReasoning, actions }
        : message);
      setMessages(workingMessages);
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      workingMessages = workingMessages.map((message, index) => {
        if (index !== assistantIndex) return message;
        if (aborted && message.content) return { ...message, content: `${message.content}\n\n（已停止生成）` };
        return {
          ...message,
          content: aborted ? "已停止生成。" : error instanceof Error ? error.message : "聊天服务暂时不可用。",
        };
      });
      setMessages(workingMessages);
      setStatusMessage("");
      setPendingImages([]);
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setSending(false);
      setStatusMessage("");
      setPendingImages([]);
      try {
        await saveStoredConversation(conversationId, workingMessages);
      } catch (storageError) {
        setNotice(storageError instanceof Error ? storageError.message : "会话记录保存失败。");
      }
    }
  }

  return (
    <main className={styles.page}>
      <button
        type="button"
        className={`${styles.mobileOverlay} ${sidebarOpen ? styles.mobileOverlayOpen : ""}`}
        aria-hidden={!sidebarOpen}
        aria-label="关闭会话列表"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <aside id="ai-conversation-sidebar" className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHead}>
          <div className={styles.sidebarBrandRow}>
            <Link href="/" className={styles.brand} title="返回博客首页">
              <Image src="/assistant-avatar.png" alt="" width={40} height={40} />
              <span><strong>甘蔗 AI</strong><small>LQPP WORLD</small></span>
            </Link>
            <button
              ref={sidebarCloseRef}
              type="button"
              className={styles.sidebarCloseButton}
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭会话列表"
              title="关闭会话列表"
            >
              ×
            </button>
          </div>
          <button type="button" className={styles.newChatButton} onClick={startNewConversation} title="新建对话">
            <span aria-hidden="true">＋</span> 新对话
          </button>
          {modeOptions.length > 1 ? (
            <label className={styles.sidebarModeSelect}>
              <span>回答模式</span>
              <select value={mode} disabled={sending} onChange={(event) => setMode(event.target.value as AiMode)}>
                {modeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {models.length > 0 ? (
            <label className={styles.sidebarModeSelect}>
              <span>使用模型</span>
              <select value={modelId} disabled={sending} onChange={(event) => { setModelId(event.target.value); setPendingImages([]); }}>
                {models.map((model) => <option value={model.id} key={model.id}>{model.providerLabel} · {model.label}{model.supportsVision ? " · 视觉" : ""}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.historyHead}>
          <span>最近对话</span>
          {historyLoading ? <small>读取中</small> : historyEnabled ? <small>保留 {retentionDays} 天</small> : null}
        </div>
        <nav className={styles.historyList} aria-label="AI 会话历史">
          {!historyLoading && !historyEnabled ? (
            <p className={styles.historyEmpty}>
              {historyReason === "database_unavailable"
                ? "会话数据库未连接，本页仍可临时对话。"
                : "会话记录未开启，本页仍可临时对话。"}
            </p>
          ) : null}
          {!historyLoading && historyEnabled && conversations.length === 0 ? (
            <p className={styles.historyEmpty}>新对话会显示在这里。</p>
          ) : null}
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`${styles.historyItem} ${conversation.id === activeConversationId ? styles.historyItemActive : ""}`}
            >
              <button type="button" onClick={() => void openConversation(conversation.id)}>
                <strong>{conversation.title}</strong>
                <small>{formatConversationDate(conversation.updatedAt)} · {conversation.messageCount} 条</small>
              </button>
              <button
                type="button"
                className={styles.historyDelete}
                onClick={() => void deleteConversation(conversation.id)}
                aria-label={`删除会话：${conversation.title}`}
                title="删除会话"
              >
                ×
              </button>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.sidebarTheme}>
            <ThemeToggle />
            <span>切换明暗主题</span>
          </div>
          {historyEnabled && conversations.length > 0 ? (
            <button type="button" onClick={() => void clearConversations()}>清空我的记录</button>
          ) : null}
          <span>记录会自动过期，管理员也可清理。</span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setSidebarOpen(true)}
            aria-controls="ai-conversation-sidebar"
            aria-expanded={sidebarOpen}
            aria-label="打开会话列表"
            title="会话列表"
          >
            ☰
          </button>
          <div className={styles.conversationTitle}>
            <strong>{activeConversation?.title || "新对话"}</strong>
            <span>{sending ? "正在生成回答" : historyEnabled ? "对话会自动保存" : "临时对话"}</span>
          </div>
          <div className={styles.topbarActions}>
            {models.length > 0 ? (
              <label className={styles.modelSelect}>
                <span className="sr-only">选择模型</span>
                <select value={modelId} disabled={sending} onChange={(event) => { setModelId(event.target.value); setPendingImages([]); }}>
                  {models.map((model) => <option value={model.id} key={model.id}>{model.providerLabel} · {model.label}{model.supportsVision ? " · 视觉" : ""}{model.supportsReasoning ? " · 思考" : ""}</option>)}
                </select>
              </label>
            ) : null}
            {modeOptions.length > 1 ? (
              <label className={styles.modeSelect}>
                <span className="sr-only">回答模式</span>
                <select value={mode} disabled={sending} onChange={(event) => setMode(event.target.value as AiMode)}>
                  {modeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            ) : null}
            <ThemeToggle />
            <Link href="/" className={styles.closeLink} aria-label="返回博客" title="返回博客">×</Link>
          </div>
        </header>

        <div className={styles.transcript} ref={transcriptRef} onScroll={handleTranscriptScroll}>
          {conversationLoading ? (
            <div className={styles.loadingState} role="status">正在读取会话...</div>
          ) : messages.length === 0 ? (
            <section className={styles.emptyState}>
              <Image src="/assistant-avatar.png" alt="甘蔗 AI" width={84} height={84} priority />
              <div>
                <p>甘蔗 AI</p>
                <h1>今天想聊点什么？</h1>
                <span>可以自由聊天，也可以查询博客里的文章、照片、项目和旅行地图。</span>
              </div>
              <div className={styles.starterGrid}>
                {STARTER_PROMPTS.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => void sendMessage(prompt)}>{prompt}<b aria-hidden="true">↗</b></button>
                ))}
              </div>
            </section>
          ) : (
            <div className={styles.messageList} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
                <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}>
                  {message.role === "assistant" ? (
                    <div className={styles.messageAvatar} aria-hidden="true">
                      <Image src="/assistant-avatar.png" alt="" width={34} height={34} />
                    </div>
                  ) : null}
                  <div className={styles.messageContent}>
                    {message.role === "assistant" ? (
                      message.content ? (
                        <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(message.content) }} />
                      ) : (
                        <span className={styles.typing} aria-label="正在生成"><i /><i /><i /></span>
                      )
                    ) : <p>{message.content}</p>}
                    {message.role === "user" && message.imagePreviews?.length ? <div className={styles.imagePreviews}>{message.imagePreviews.map((src, imageIndex) => <Image src={src} alt={message.imageNames?.[imageIndex] || "附加图片"} width={72} height={72} unoptimized key={`${message.id}-image-${imageIndex}`} />)}</div> : null}
                    {message.role === "user" && message.imageNames?.length ? <div className={styles.imageNames}>附加图片：{message.imageNames.join("、")}</div> : null}
                    {message.role === "assistant" && message.reasoning ? <details className={styles.reasoning}><summary>思考摘要</summary><div>{message.reasoning}</div></details> : null}
                    {message.actions?.length ? (
                      <div className={styles.actionList} aria-label="相关页面">
                        {message.actions.map((action) => (
                          <Link href={action.href} key={`${action.kind}-${action.href}`}>
                            <span>{action.label}</span><b aria-hidden="true">↗</b>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className={styles.composerArea}>
          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          {statusMessage ? <div className={styles.statusMessage} role="status">{statusMessage}</div> : null}
          {pendingImages.length > 0 ? <div className={styles.pendingImages}>{pendingImages.map((image) => <span key={image.name}>{image.name}<button type="button" onClick={() => setPendingImages((current) => current.filter((item) => item.name !== image.name))} aria-label={`移除 ${image.name}`}>×</button></span>)}</div> : null}
          <div className={styles.composer}>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => void handleImageFiles(event.target.files)} />
            <button type="button" className={styles.attachButton} onClick={() => imageInputRef.current?.click()} disabled={sending || !models.some((model) => model.id === modelId && model.supportsVision)} aria-label="附加图片" title="附加图片">＋</button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              maxLength={maxMessageLength}
              placeholder="给甘蔗 AI 发消息"
              aria-label="聊天消息"
              disabled={conversationLoading || historyLoading}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              type="button"
              className={styles.sendButton}
              disabled={!sending && (!input.trim() || conversationLoading || historyLoading)}
              onClick={sending ? stopResponse : () => void sendMessage()}
              aria-label={sending ? "停止生成" : "发送消息"}
              title={sending ? "停止生成" : "发送消息"}
            >
              {sending ? <span className={styles.stopIcon} /> : <span aria-hidden="true">↑</span>}
            </button>
          </div>
          <p>AI 可能会犯错，重要信息请自行核实。</p>
        </footer>
      </section>
    </main>
  );
}
