"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { renderAssistantMarkdown } from "@/lib/assistant-markdown";
import { readSseEvents } from "@/lib/ai-sse";
import { describeResendFallout, findLastUserIndex, mergeImagesByUrl, planResend } from "@/lib/ai-message-resend";
import { ModelPicker } from "./ModelPicker";
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
  /** 文本/代码附件的文件名，仅用于展示，内容已并入 content */
  fileNames?: string[];
  createdAt: string;
  /** 该条是错误提示而非模型真实回答，不参与后续请求的上下文 */
  errored?: boolean;
  /** 模型因输出长度上限而中断，可以请求继续 */
  truncated?: boolean;
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
  modelId?: string;
  /** 仅后台 AI 页：会话级自定义指令 */
  instructions?: string;
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

const DEVELOPER_STARTER_PROMPTS = [
  "帮我分析一个技术方案",
  "检查这段代码可能存在的问题",
  "把一个复杂概念讲清楚",
  "协助我整理需求和实现步骤",
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
  return messages.map(({ id, role, content, actions, reasoning, imageNames, fileNames, createdAt, errored, truncated }) => ({
    id,
    role,
    content,
    actions,
    reasoning,
    imageNames,
    fileNames,
    createdAt,
    // 一并持久化：重新载入历史会话后，错误标记与截断标记仍然有效，
    // 否则刷新页面后旧的错误提示会重新变成「正常回答」污染上下文。
    errored,
    truncated,
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

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败。`));
    reader.readAsText(file);
  });
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** 直传兜底阈值：Blob 未配置时退回 base64 内联，只对小图放行以免撞上请求体上限 */
const INLINE_FALLBACK_BYTES = 1.5 * 1024 * 1024;

const MAX_TEXT_FILE_COUNT = 3;
const MAX_TEXT_FILE_BYTES = 256 * 1024;
/** 单个文件注入提示词的字符上限，避免一个大文件吃掉整个上下文窗口 */
const MAX_TEXT_FILE_CHARS = 20000;

/**
 * 文本/代码附件的扩展名白名单。
 *
 * 不按 MIME 判断：浏览器给 .ts、.vue、.rs 之类的文件常常报空字符串或
 * application/octet-stream，只看 MIME 会把正常代码文件全部拒掉。
 */
const TEXT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "log", "csv", "tsv",
  "json", "jsonc", "yaml", "yml", "toml", "ini", "env", "conf", "properties",
  "xml", "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "vue", "svelte",
  "py", "rb", "go", "rs", "java", "kt", "kts", "swift", "c", "h", "cpp", "hpp", "cc", "cs",
  "php", "sh", "bash", "zsh", "fish", "ps1", "sql", "graphql", "gql",
  "dockerfile", "gitignore", "editorconfig", "lua", "r", "pl", "dart", "scala", "ex", "exs",
]);

function getFileExtension(name: string) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot === -1) return lower;
  return lower.slice(dot + 1);
}

function isTextLikeFile(file: File) {
  if (file.type.startsWith("text/")) return true;
  return TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name));
}

// 附件正文的拼装放在服务端（app/api/chat/route.ts 的 buildAttachmentContext）：
// 客户端只负责读取与截断，避免两边各写一份格式各自漂移。

function formatConversationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export default function AiChatPage({ developerMode = false }: { developerMode?: boolean }) {
  const conversationBase = developerMode
    ? "/api/ai-developer-conversations"
    : "/api/ai-conversations";
  const starterPrompts = developerMode ? DEVELOPER_STARTER_PROMPTS : STARTER_PROMPTS;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AiMode>("guide");
  const [modeOptions, setModeOptions] = useState(DEFAULT_MODES);
  const [models, setModels] = useState<PublicAiModel[]>([]);
  const [modelId, setModelId] = useState("");
  /**
   * 待发送图片。url 既发给模型也用于本地预览：
   * Blob 直传得到公开 https 地址，base64 兜底得到 data URL，两者都能直接渲染，
   * 因此不额外创建 object URL——那种地址一旦释放，已发出消息里的缩略图会变成裂图。
   */
  const [pendingImages, setPendingImages] = useState<Array<{ name: string; url: string }>>([]);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ name: string; text: string; truncated: boolean }>
  >([]);
  const [uploading, setUploading] = useState(false);
  /**
   * 会话级自定义指令（仅后台 AI 页）。随会话一起存取，
   * 载入旧会话时会被恢复，因此换设备/刷新后设定仍然生效。
   */
  const [instructions, setInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  /**
   * 正在编辑的用户消息 id 与草稿。
   *
   * 只允许编辑最后一条用户消息：改中间某条就得决定它后面的问答怎么处理，
   * 无论是全部丢弃还是尝试保留都会让人意外。限定在最后一条，语义只有一种：
   * 回到那一刻重问。
   */
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");

  /** 清空待发送附件 */
  const clearPendingAttachments = useCallback(() => {
    setPendingImages([]);
    setPendingFiles([]);
  }, []);

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

  /**
   * 切换模型。
   *
   * 只在必要时丢弃待发送图片：图片可能是刚上传上去的几 MB 文件，
   * 换个模型就静默清空等于让用户白传一次。文本附件所有模型都能读，一律保留。
   */
  const handleModelChange = useCallback((nextModelId: string) => {
    setModelId(nextModelId);
    const nextModel = models.find((model) => model.id === nextModelId);
    // 判断放在更新函数外面：setState 的 updater 必须是纯函数，
    // 在里面调 setNotice 会在 StrictMode 下被执行两次。
    if (nextModel && !nextModel.supportsVision && pendingImages.length > 0) {
      setPendingImages([]);
      setNotice(`${nextModel.label} 不支持读图，已移除待发送的图片；文本附件仍会发送。`);
    }
  }, [models, pendingImages.length]);
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
          fetch(developerMode ? "/api/chat?developerMode=1" : "/api/chat", { cache: "no-store" }),
          fetch(conversationBase, { cache: "no-store" }),
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
            setRetentionDays(developerMode ? 0 : history.policy?.retentionDays || 30);
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
  }, [conversationBase, developerMode]);

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
    clearPendingAttachments();
    // 编辑状态必须收掉：草稿属于旧会话的那条消息，留着会指向一条已经不在列表里的消息。
    cancelEditing();
    // 指令刻意不清空：新建会话多数是想换个话题继续用同一套设定，
    // 每次重填成本太高。要撤掉就手动清空输入框，是显式操作。
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
    cancelEditing();
    try {
      const response = await fetch(`${conversationBase}/${id}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
      const conversation = data?.conversation;
      if (!response.ok || !conversation) throw new Error(data?.error || "读取会话失败。");
      setActiveConversationId(conversation.id);
      if (!developerMode) {
        setMode(modeOptions.some((item) => item.value === conversation.mode)
          ? conversation.mode
          : modeOptions[0]?.value || "guide");
      }
      if (developerMode && conversation.modelId && models.some((item) => item.id === conversation.modelId)) {
        setModelId(conversation.modelId);
      }
      if (developerMode) setInstructions(conversation.instructions || "");
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
    const response = await fetch(conversationBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        modelId,
        messages: toStoredMessages(nextMessages),
        ...(developerMode ? { instructions } : {}),
      }),
    });
    const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
    if (!response.ok || !data?.conversation) throw new Error(data?.error || "创建会话记录失败。");
    setActiveConversationId(data.conversation.id);
    upsertConversation(data.conversation);
    return data.conversation.id;
  }

  async function saveStoredConversation(id: string | null, nextMessages: ChatMessage[]) {
    if (!historyEnabled || !id) return;
    const response = await fetch(`${conversationBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        modelId,
        messages: toStoredMessages(nextMessages),
        ...(developerMode ? { instructions } : {}),
      }),
    });
    const data = await response.json().catch(() => null) as { conversation?: ConversationDetail; error?: string } | null;
    if (!response.ok || !data?.conversation) throw new Error(data?.error || "保存会话记录失败。");
    upsertConversation(data.conversation);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("确定删除这条会话记录吗？删除后无法恢复。")) return;
    try {
      const response = await fetch(`${conversationBase}/${id}`, { method: "DELETE" });
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
      const response = await fetch(conversationBase, { method: "DELETE" });
      if (!response.ok) throw new Error("清空会话失败。");
      setConversations([]);
      startNewConversation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "清空会话失败。");
    }
  }

  /**
   * 把一张图片送到 Blob，返回给模型用的地址。
   *
   * 走客户端直传是因为 Vercel Functions 的请求体上限为 4.5MB，
   * 而 base64 内联后体积还会再涨约 1/3，稍大的图片必定被平台拒绝。
   * 若服务端未配置 Blob（自托管场景），小图退回 base64 内联，保证功能不完全失效。
   */
  async function uploadImage(file: File) {
    try {
      const { upload } = await import("@vercel/blob/client");
      // 清洗文件名：含 "/" 或 ".." 的名字会跳出 ai-chat/ 前缀，写到预期之外的路径。
      const safeName = file.name.replace(/[^\w.\-一-龥]/g, "_").replace(/\.{2,}/g, ".") || "image";
      const result = await upload(`ai-chat/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/chat-upload",
        contentType: file.type,
      });
      return result.url;
    } catch (error) {
      if (file.size <= INLINE_FALLBACK_BYTES) {
        return await readFileAsDataUrl(file);
      }
      const message = error instanceof Error ? error.message : "图片上传失败。";
      throw new Error(`${message}（超过 1.5MB 的图片需要服务端配置对象存储）`);
    }
  }

  async function handleAttachmentFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const images = selected.filter((file) => IMAGE_TYPES.includes(file.type));
    const textFiles = selected.filter((file) => !IMAGE_TYPES.includes(file.type) && isTextLikeFile(file));
    const rejected = selected.filter((file) => !images.includes(file) && !textFiles.includes(file));

    if (rejected.length) {
      setNotice(`不支持的文件类型：${rejected.map((file) => file.name).join("、")}。可附加图片，或文本与代码文件。`);
      return;
    }
    if (images.length > MAX_IMAGE_COUNT) {
      setNotice(`最多附加 ${MAX_IMAGE_COUNT} 张图片。`);
      return;
    }
    if (textFiles.length > MAX_TEXT_FILE_COUNT) {
      setNotice(`最多附加 ${MAX_TEXT_FILE_COUNT} 个文件。`);
      return;
    }
    if (images.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setNotice("单张图片不能超过 8MB。");
      return;
    }
    if (textFiles.some((file) => file.size > MAX_TEXT_FILE_BYTES)) {
      setNotice("单个文本文件不能超过 256KB。");
      return;
    }

    const selectedModel = models.find((model) => model.id === modelId);
    if (images.length && !selectedModel?.supportsVision) {
      setNotice("当前模型不支持读图，请换一个带「视觉」标记的模型，或改为附加文本文件。");
      return;
    }

    setNotice("");
    setUploading(true);
    try {
      if (textFiles.length) {
        const texts = await Promise.all(textFiles.map(readFileAsText));
        setPendingFiles(
          textFiles.map((file, index) => {
            const raw = texts[index];
            return {
              name: file.name,
              text: raw.slice(0, MAX_TEXT_FILE_CHARS),
              truncated: raw.length > MAX_TEXT_FILE_CHARS,
            };
          })
        );
      }
      if (images.length) {
        const uploaded = await Promise.all(
          images.map(async (file) => ({ name: file.name, url: await uploadImage(file) }))
        );
        setPendingImages(uploaded);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "附件处理失败。");
    } finally {
      setUploading(false);
    }
  }

  const stopResponse = useCallback(() => {
    requestControllerRef.current?.abort();
  }, []);

  /**
   * 发送一轮对话。
   * - 默认：把输入框（或快捷问题）内容作为新的用户消息追加后请求。
   * - baseMessages：指定请求所用的历史，用于「重新生成」时丢弃失败的那一轮。
   * - extraUserText：不占用输入框、临时追加的用户指令，用于「继续生成」。
   * - restoreImages：重发时带回原消息的图片。
   *   与输入框里已排队的图片合并而不是覆盖：用户可能正是「忘了附文件，回去补一个」，
   *   覆盖等于把刚上传的几 MB 静默丢掉。按 url 去重，重复点重发不会叠加同一张图。
   *   之所以不让调用方先 setPendingImages 再调本函数：setState 是异步的，
   *   同一个事件处理函数里读不到新值，图片会静默丢掉。
   */
  async function sendMessage(
    textFromStarter?: string,
    options?: {
      baseMessages?: ChatMessage[];
      extraUserText?: string;
      restoreImages?: Array<{ name: string; url: string }>;
    }
  ) {
    const baseMessages = options?.baseMessages ?? messages;
    const attachImages = mergeImagesByUrl(options?.restoreImages ?? [], pendingImages);
    const extraUserText = options?.extraUserText?.trim() || "";
    const text = extraUserText || (textFromStarter ?? input).trim();
    if (!text || sending || historyLoading) return;
    if (text.length > maxMessageLength) {
      setNotice(`消息请控制在 ${maxMessageLength} 字以内。`);
      return;
    }

    setNotice("");
    setStatusMessage("");
    // 只有正文确实来自输入框时才清空它。快捷问题、重新生成、编辑重发用的都是别处的文本，
    // 清空会顺手删掉用户已经打了一半的下一个问题。
    if (textFromStarter === undefined && !extraUserText) setInput("");
    setSending(true);
    stickToBottomRef.current = true;
    const userMessage = {
      ...createMessage("user", text),
      imageNames: attachImages.map((image) => image.name),
      imagePreviews: attachImages.map((image) => image.url),
      fileNames: pendingFiles.map((file) => file.name),
    };
    const assistantMessage = createMessage("assistant", "");
    const requestMessages = [...baseMessages, userMessage];
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
          // 剔除错误提示与空内容：它们不是模型的真实发言，
          // 一旦混进历史会让模型把「服务不可用」当成自己上一轮的回答，导致上下文错乱。
          messages: requestMessages
            .filter((message) => !message.errored && message.content.trim())
            .map(({ role, content }) => ({ role, content })),
          pageUrl: window.location.href,
          surface: "workspace",
          developerMode,
          mode,
          modelId,
          ...(developerMode && instructions.trim() ? { instructions } : {}),
          images: attachImages.map((image) => image.url),
          // 文本附件单独传，不拼进消息正文：正文要受 maxMessageLength（默认 2000 字）限制，
          // 一个几百行的代码文件拼进去必然被服务端判为「消息太长」。
          attachments: pendingFiles.map((file) => ({
            name: file.name,
            text: file.text,
            truncated: file.truncated,
          })),
          responseFormat: "sse",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "聊天失败，请稍后再试。");
      }
      if (!response.body) throw new Error("当前浏览器不支持流式回答。");

      // 早期上下文被压缩成摘要时给出提示：否则用户只会感觉模型突然「忘事」。
      const compressedCount = Number(response.headers.get("X-Chat-Compressed") || 0);
      if (compressedCount > 0) {
        setNotice(`对话已超出上下文预算，最早 ${compressedCount} 条消息已压缩为摘要参与本轮回答。`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullReply = "";
      let fullReasoning = "";
      let actions: ChatAction[] = [];
      let hitOutputLimit = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const parsed = readSseEvents(sseBuffer);
        sseBuffer = parsed.remainder;
        for (const event of parsed.events) {
          const data = event.data as { delta?: string; message?: string; actions?: ChatAction[]; url?: string; mode?: AiMode; error?: string; truncated?: boolean };
          if (event.event === "done" && data.truncated) hitOutputLimit = true;
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
      const hasReply = Boolean(fullReply.trim());
      workingMessages = workingMessages.map((message, index) => index === assistantIndex
        ? {
            ...message,
            content: hasReply ? fullReply : "没有收到有效回复，可以换个问法再试一次。",
            reasoning: fullReasoning,
            actions,
            errored: !hasReply,
            truncated: hasReply && hitOutputLimit,
          }
        : message);
      setMessages(workingMessages);
      if (hitOutputLimit) {
        setNotice("回答达到输出长度上限被截断，可以点「继续生成」接着写，或在后台调高最大输出 tokens。");
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      workingMessages = workingMessages.map((message, index) => {
        if (index !== assistantIndex) return message;
        // 手动停止时已产出的正文是有效回答，保留内容并标记可继续；
        // 彻底失败时把错误文案标记为 errored，避免它被当成模型的真实回答带进后续上下文。
        if (aborted && message.content) {
          return { ...message, content: message.content, truncated: true };
        }
        return {
          ...message,
          content: aborted ? "已停止生成。" : error instanceof Error ? error.message : "聊天服务暂时不可用。",
          errored: true,
        };
      });
      setMessages(workingMessages);
      setStatusMessage("");
      clearPendingAttachments();
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setSending(false);
      setStatusMessage("");
      clearPendingAttachments();
      try {
        await saveStoredConversation(conversationId, workingMessages);
      } catch (storageError) {
        setNotice(storageError instanceof Error ? storageError.message : "会话记录保存失败。");
      }
    }
  }

  /** 当前模型能不能读图。模型池为空（配置未就绪）时按不支持处理，避免带图撞必然失败的请求。 */
  const modelSupportsVision = models.find((model) => model.id === modelId)?.supportsVision ?? false;
  /** 最后一条用户消息的下标：只有它能被编辑重发。不用 useMemo，这个查找从末尾起通常一两步就命中。 */
  const lastUserIndex = findLastUserIndex(messages);

  /**
   * 重新生成最后一轮回答：丢弃失败或不满意的助手消息，用同一个问题重新请求。
   * 关键是把历史回退到该问题之前，避免旧的错误提示或半截回答污染上下文。
   */
  async function regenerateLast() {
    if (sending || historyLoading) return;
    const plan = planResend(messages, modelSupportsVision);
    if (!plan) return;
    const baseMessages = messages.slice(0, plan.index);
    setMessages(baseMessages);
    await sendMessage(plan.message.content, { baseMessages, restoreImages: plan.images });
    // sendMessage 开头会清空提示，因此附件去向的说明必须等请求结束后再给出。
    const fallout = describeResendFallout(plan.imagesDropped, plan.lostFileNames);
    if (fallout) setNotice(fallout);
  }

  /** 把最后一条用户消息放回可编辑状态。 */
  function startEditingLastUser() {
    if (sending || historyLoading) return;
    const plan = planResend(messages, modelSupportsVision);
    if (!plan) return;
    setEditingMessageId(plan.message.id);
    setEditingDraft(plan.message.content);
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditingDraft("");
  }

  /**
   * 用改写后的内容重发最后一条用户消息。
   * 与「重新生成」的差别只在问题文本，历史回退和附件处理完全一致。
   */
  async function resendEditedMessage() {
    if (sending || historyLoading) return;
    const text = editingDraft.trim();
    if (!text) {
      setNotice("消息内容不能为空。");
      return;
    }
    if (text.length > maxMessageLength) {
      setNotice(`消息请控制在 ${maxMessageLength} 字以内。`);
      return;
    }
    const plan = planResend(messages, modelSupportsVision);
    if (!plan || plan.message.id !== editingMessageId) {
      // 编辑期间切换或清空了会话，此时重发会写进另一个会话。
      cancelEditing();
      setNotice("会话已变化，请重新编辑。");
      return;
    }
    const baseMessages = messages.slice(0, plan.index);
    cancelEditing();
    setMessages(baseMessages);
    await sendMessage(text, { baseMessages, restoreImages: plan.images });
    const fallout = describeResendFallout(plan.imagesDropped, plan.lostFileNames);
    if (fallout) setNotice(fallout);
  }

  /** 从截断处继续输出，不重复已写内容。 */
  async function continueLast() {
    if (sending || historyLoading) return;
    await sendMessage(undefined, {
      extraUserText: "请从上一条回答被截断的位置继续写完，不要重复已经输出过的内容。",
    });
  }

  return (
    <main className={`${styles.page} ${developerMode ? styles.developerPage : ""}`}>
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
            <Link href={developerMode ? "/admin" : "/"} className={styles.brand} title={developerMode ? "返回后台" : "返回博客首页"}>
              {developerMode
                ? <b className={styles.developerBrandMark} aria-hidden="true">DEV</b>
                : <Image src="/assistant-avatar.png" alt="" width={40} height={40} />}
              <span><strong>{developerMode ? "Developer AI" : "甘蔗 AI"}</strong><small>{developerMode ? "PURE MODEL" : "LQPP WORLD"}</small></span>
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
          {!developerMode && modeOptions.length > 1 ? (
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
              <select value={modelId} disabled={sending} onChange={(event) => handleModelChange(event.target.value)}>
                {models.map((model) => <option value={model.id} key={model.id}>{model.providerLabel} · {model.label}{model.supportsVision ? " · 视觉" : ""}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.historyHead}>
          <span>最近对话</span>
          {historyLoading ? <small>读取中</small> : historyEnabled ? <small>{developerMode ? "永久保存" : `保留 ${retentionDays} 天`}</small> : null}
        </div>
        <nav className={styles.historyList} aria-label="AI 会话历史">
          {!historyLoading && !historyEnabled ? (
            <p className={styles.historyEmpty}>
              {historyReason === "database_unavailable"
                ? developerMode ? "数据库未连接，开发者对话暂时无法持久保存。" : "会话数据库未连接，本页仍可临时对话。"
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
            <button type="button" onClick={() => void clearConversations()}>{developerMode ? "清空开发者记录" : "清空我的记录"}</button>
          ) : null}
          <span>{developerMode ? "不会自动过期，可在这里手动清理。" : "记录会自动过期，管理员也可清理。"}</span>
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
            <span>{sending ? "正在生成回答" : historyEnabled ? developerMode ? "开发者会话永久保存" : "对话会自动保存" : "临时对话"}</span>
          </div>
          <div className={styles.topbarActions}>
            {developerMode ? (
              <button
                type="button"
                className={styles.instructionsToggle}
                data-active={instructions.trim() ? "true" : "false"}
                onClick={() => setInstructionsOpen((open) => !open)}
                aria-expanded={instructionsOpen}
                aria-controls="ai-custom-instructions"
                title={instructions.trim() ? "已设置自定义指令" : "设置自定义指令"}
              >
                指令{instructions.trim() ? " ●" : ""}
              </button>
            ) : null}
            <ModelPicker
              models={models}
              value={modelId}
              disabled={sending}
              onChange={handleModelChange}
            />

            {!developerMode && modeOptions.length > 1 ? (
              <label className={styles.modeSelect}>
                <span className="sr-only">回答模式</span>
                <select value={mode} disabled={sending} onChange={(event) => setMode(event.target.value as AiMode)}>
                  {modeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            ) : null}
            <ThemeToggle />
            <Link href={developerMode ? "/admin" : "/"} className={styles.closeLink} aria-label={developerMode ? "返回后台" : "返回博客"} title={developerMode ? "返回后台" : "返回博客"}>×</Link>
          </div>
        </header>

        <div className={styles.transcript} ref={transcriptRef} onScroll={handleTranscriptScroll}>
          {conversationLoading ? (
            <div className={styles.loadingState} role="status">正在读取会话...</div>
          ) : messages.length === 0 ? (
            <section className={styles.emptyState}>
              {developerMode
                ? <div className={styles.developerMark} aria-hidden="true">DEV</div>
                : <Image src="/assistant-avatar.png" alt="甘蔗 AI" width={84} height={84} priority />}
              <div>
                <p>{developerMode ? "Developer AI" : "甘蔗 AI"}</p>
                <h1>{developerMode ? "直接使用原始模型" : "今天想聊点什么？"}</h1>
                <span>{developerMode ? "不附加博客角色、知识文本、回答模式或站内推荐。" : "可以自由聊天，也可以查询博客里的文章、照片、项目和旅行地图。"}</span>
              </div>
              <div className={styles.starterGrid}>
                {starterPrompts.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => void sendMessage(prompt)}>{prompt}<b aria-hidden="true">↗</b></button>
                ))}
              </div>
            </section>
          ) : (
            <div className={styles.messageList} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, messageIndex) => (
                <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}>
                  {message.role === "assistant" ? (
                    <div className={`${styles.messageAvatar} ${developerMode ? styles.developerMessageAvatar : ""}`} aria-hidden="true">
                      {developerMode ? <span>AI</span> : <Image src="/assistant-avatar.png" alt="" width={34} height={34} />}
                    </div>
                  ) : null}
                  <div className={`${styles.messageContent} ${editingMessageId === message.id ? styles.messageContentEditing : ""}`}>
                    {message.role === "assistant" ? (
                      message.content ? (
                        <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(message.content) }} />
                      ) : (
                        <span className={styles.typing} aria-label="正在生成"><i /><i /><i /></span>
                      )
                    ) : editingMessageId === message.id ? (
                      <div className={styles.editBox}>
                        <label className="sr-only" htmlFor={`ai-edit-${message.id}`}>编辑这条提问</label>
                        <textarea
                          id={`ai-edit-${message.id}`}
                          value={editingDraft}
                          maxLength={maxMessageLength}
                          rows={3}
                          autoFocus
                          onChange={(event) => setEditingDraft(event.target.value)}
                          onKeyDown={(event) => {
                            // 与主输入框保持一致：Enter 发送，Shift+Enter 换行，Esc 放弃编辑。
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEditing();
                            }
                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                              event.preventDefault();
                              void resendEditedMessage();
                            }
                          }}
                        />
                        <div className={styles.editActions}>
                          <span>{editingDraft.length} / {maxMessageLength}</span>
                          <button type="button" onClick={cancelEditing}>取消</button>
                          <button
                            type="button"
                            className={styles.editPrimary}
                            onClick={() => void resendEditedMessage()}
                            disabled={!editingDraft.trim()}
                          >
                            重发
                          </button>
                        </div>
                      </div>
                    ) : <p>{message.content}</p>}
                    {message.role === "user" && message.imagePreviews?.length ? <div className={styles.imagePreviews}>{message.imagePreviews.map((src, imageIndex) => <Image src={src} alt={message.imageNames?.[imageIndex] || "附加图片"} width={72} height={72} unoptimized key={`${message.id}-image-${imageIndex}`} />)}</div> : null}
                    {message.role === "user" && message.imageNames?.length ? <div className={styles.imageNames}>附加图片：{message.imageNames.join("、")}</div> : null}
                    {message.role === "user" && message.fileNames?.length ? <div className={styles.imageNames}>附加文件：{message.fileNames.join("、")}</div> : null}
                    {/*
                      只给最后一条用户消息编辑入口。模型没回复（报错、空回复、被停止）时，
                      这条消息就在错误提示的上面，改完直接重发，不用手抄一遍原文。
                    */}
                    {message.role === "user"
                      && messageIndex === lastUserIndex
                      && editingMessageId !== message.id
                      && !sending
                      && !historyLoading ? (
                      <div className={styles.replyActions}>
                        <button type="button" onClick={startEditingLastUser}>编辑并重发</button>
                      </div>
                    ) : null}
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
                    {/* 仅最后一条助手消息提供重试入口：截断时可续写，失败或不满意时可重生成 */}
                    {message.role === "assistant"
                      && messageIndex === messages.length - 1
                      && !sending
                      && message.content ? (
                      <div className={styles.replyActions}>
                        {message.truncated ? (
                          <button type="button" onClick={() => void continueLast()}>继续生成</button>
                        ) : null}
                        <button type="button" onClick={() => void regenerateLast()}>重新生成</button>
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
          {developerMode && instructionsOpen ? (
            <div className={styles.instructionsPanel} id="ai-custom-instructions">
              <label htmlFor="ai-instructions-input">
                自定义指令
                <em>每轮以 system 消息发送，随会话保存；留空即不发送。</em>
              </label>
              <textarea
                id="ai-instructions-input"
                value={instructions}
                maxLength={4000}
                rows={4}
                placeholder="例如：你是资深 TypeScript 工程师，回答先给结论再给代码，不要写多余解释。"
                onChange={(event) => setInstructions(event.target.value)}
              />
              <div className={styles.instructionsFooter}>
                <span>{instructions.length} / 4000</span>
                <button type="button" onClick={() => setInstructions("")} disabled={!instructions}>
                  清空
                </button>
              </div>
            </div>
          ) : null}
          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          {statusMessage ? <div className={styles.statusMessage} role="status">{statusMessage}</div> : null}
          {pendingImages.length > 0 || pendingFiles.length > 0 ? (
            <div className={styles.pendingImages}>
              {pendingImages.map((image) => (
                <span key={`image-${image.name}`}>
                  {image.name}
                  <button
                    type="button"
                    onClick={() => setPendingImages((current) => current.filter((item) => item.name !== image.name))}
                    aria-label={`移除 ${image.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {pendingFiles.map((file) => (
                <span key={`file-${file.name}`}>
                  {file.name}
                  {file.truncated ? "（已截断）" : ""}
                  <button
                    type="button"
                    onClick={() => setPendingFiles((current) => current.filter((item) => item.name !== file.name))}
                    aria-label={`移除 ${file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className={styles.composer}>
            {/* 不再限制 accept 为图片：文本与代码文件对所有模型都可用，
                即使当前模型没有视觉能力也能读到文件内容。 */}
            <input
              ref={imageInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                void handleAttachmentFiles(event.target.files);
                // 清空 value，否则连续选同一个文件不会再触发 change
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.attachButton}
              onClick={() => imageInputRef.current?.click()}
              disabled={sending || uploading}
              aria-label="附加图片或文件"
              title={
                models.some((model) => model.id === modelId && model.supportsVision)
                  ? "附加图片或文本文件"
                  : "附加文本文件（当前模型不支持读图）"
              }
            >
              {uploading ? "…" : "＋"}
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              maxLength={maxMessageLength}
              placeholder={developerMode ? "给模型发消息" : "给甘蔗 AI 发消息"}
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
