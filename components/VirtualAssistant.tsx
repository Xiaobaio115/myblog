"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSafeInternalHref } from "@/lib/internal-href";
import { renderAssistantMarkdown } from "@/lib/assistant-markdown";
import styles from "./VirtualAssistant.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
};

type ChatAction = {
  label: string;
  href: string;
  kind: "article" | "series" | "photos" | "project" | "travel";
};

type AiMode = "guide" | "companion" | "technical" | "writer";

type ChatPublicConfig = {
  defaultMode?: AiMode;
  enabledModes?: AiMode[];
  modes?: Array<{ value: AiMode; label: string }>;
};

const AI_MODE_OPTIONS: Array<{ value: AiMode; label: string }> = [
  { value: "guide", label: "导览" },
  { value: "companion", label: "聊天" },
  { value: "technical", label: "技术" },
  { value: "writer", label: "写作" },
];

const DEFAULT_MODE_LABELS = Object.fromEntries(
  AI_MODE_OPTIONS.map((option) => [option.value, option.label])
) as Record<AiMode, string>;

const quickPrompts = [
  "最近的文章有哪些？",
  "旅行地图在哪里？",
  "怎么打开 3D 照片墙？",
];

const quickLinks = [
  { href: "/articles", label: "读文章", eyebrow: "READ" },
  { href: "/photos", label: "看照片", eyebrow: "PHOTO" },
  { href: "/world/travel-map", label: "去地图", eyebrow: "MAP" },
];

function parseChatActions(value: string | null): ChatAction[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ChatAction => {
      if (!item || typeof item !== "object") return false;
      const action = item as Partial<ChatAction>;
      return typeof action.label === "string" &&
        isSafeInternalHref(action.href);
    }).slice(0, 6);
  } catch {
    return [];
  }
}

export default function VirtualAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<AiMode>("guide");
  const [enabledModes, setEnabledModes] = useState<AiMode[]>(["guide"]);
  const [modeLabels, setModeLabels] = useState<Record<AiMode, string>>(DEFAULT_MODE_LABELS);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "你好，我是甘蔗小助手。可以帮你找文章、相册、旅行地图和留言入口。",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    async function loadConfig() {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        if (!response.ok) return;
        const config = await response.json() as ChatPublicConfig;
        const configuredModes = Array.isArray(config.modes) ? config.modes : [];
        const available = AI_MODE_OPTIONS
          .map((option) => option.value)
          .filter((value) => configuredModes.length > 0
            ? configuredModes.some((item) => item.value === value)
            : config.enabledModes?.includes(value));
        if (!active || available.length === 0) return;
        const configuredLabels = configuredModes.reduce((labels, item) => {
          if (available.includes(item.value) && item.label.trim()) labels[item.value] = item.label.trim();
          return labels;
        }, { ...DEFAULT_MODE_LABELS });
        const initial = config.defaultMode && available.includes(config.defaultMode)
          ? config.defaultMode
          : available[0];
        setEnabledModes(available);
        setModeLabels(configuredLabels);
        setMode(initial);
      } catch {
        // The guide mode remains available when public configuration cannot load.
      }
    }
    void loadConfig();
    return () => { active = false; };
  }, []);

  const modeOptions = useMemo(
    () => AI_MODE_OPTIONS.map((option) => ({ ...option, label: modeLabels[option.value] || option.label })),
    [modeLabels]
  );

  const stopResponse = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const closeAssistant = useCallback(() => {
    stopResponse();
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [stopResponse]);

  useEffect(() => {
    if (!open) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAssistant();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAssistant, open]);

  useEffect(() => {
    return () => requestControllerRef.current?.abort();
  }, [pathname]);

  async function sendMessage(textFromButton?: string) {
    const text = (textFromButton || input).trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    const assistantIndex = nextMessages.length;

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          pageUrl: window.location.href,
          mode,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "聊天失败，请稍后再试。");
      }

      if (!response.body) {
        throw new Error("当前浏览器不支持流式响应。");
      }

      const actions = parseChatActions(response.headers.get("X-Chat-Actions"));
      const confirmedMode = response.headers.get("X-Chat-Mode") as AiMode | null;
      if (confirmedMode && enabledModes.includes(confirmedMode)) setMode(confirmedMode);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        fullReply += decoder.decode(value, { stream: true });

        setMessages((currentMessages) => {
          const copiedMessages = [...currentMessages];
          copiedMessages[assistantIndex] = {
            role: "assistant",
            content: fullReply || "甘蔗正在整理回答...",
            actions,
          };
          return copiedMessages;
        });
      }

      fullReply += decoder.decode();

      if (fullReply.trim()) {
        setMessages((currentMessages) => {
          const copiedMessages = [...currentMessages];
          copiedMessages[assistantIndex] = { role: "assistant", content: fullReply, actions };
          return copiedMessages;
        });
      }

      if (!fullReply.trim()) {
        setMessages((currentMessages) => {
          const copiedMessages = [...currentMessages];
          copiedMessages[assistantIndex] = {
            role: "assistant",
            content: "我刚刚没有收到有效回复，可以换个问法再试一次。",
          };
          return copiedMessages;
        });
      }
    } catch (error: unknown) {
      const aborted = error instanceof Error && error.name === "AbortError";
      const message = aborted
        ? "已停止生成。"
        : error instanceof Error
          ? error.message
          : "聊天服务暂时有点小故障，可以稍后再试。";
      setMessages((currentMessages) => {
        const copiedMessages = [...currentMessages];
        const currentReply = copiedMessages[assistantIndex]?.content;
        copiedMessages[assistantIndex] = {
          role: "assistant",
          content: aborted && currentReply ? `${currentReply}\n\n（已停止生成）` : message,
        };
        return copiedMessages;
      });
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setSending(false);
    }
  }

  if (pathname.startsWith("/admin")) return null;

  return (
    <div className={`${styles.root} virtual-assistant${pathname === "/world/travel-map" ? " is-map-page" : ""}`}>
      {open && (
        <div className="assistant-panel" role="dialog" aria-modal="false" aria-label="甘蔗小助手">
          <div className="assistant-header">
            <div className="assistant-title-row">
              <span className="assistant-mini-avatar" aria-hidden="true">
                <Image
                  src="/assistant-avatar.png"
                  alt=""
                  width={1254}
                  height={1254}
                  draggable={false}
                />
              </span>
              <div>
                <strong>甘蔗小助手</strong>
                <span aria-live="polite">{sending ? "正在思考你的问题..." : "文章、相册、旅行地图都可以问我"}</span>
              </div>
            </div>

            <button onClick={closeAssistant} type="button" aria-label="关闭聊天助手">
              ×
            </button>
          </div>

          <nav className={styles.destinations} aria-label="站内快捷入口">
            {quickLinks.map((item) => (
              <Link href={item.href} key={item.href} onClick={closeAssistant}>
                <small>{item.eyebrow}</small>
                <span>{item.label}</span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
          </nav>

          {enabledModes.length > 1 ? (
            <div className={styles.modeSwitch} role="group" aria-label="AI 回答模式">
              {modeOptions.filter((option) => enabledModes.includes(option.value)).map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={mode === option.value ? styles.modeActive : ""}
                  aria-pressed={mode === option.value}
                  disabled={sending}
                  onClick={() => setMode(option.value)}
                  title={option.label}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="assistant-quick-actions" aria-label="快捷问题">
            {quickPrompts.map((prompt) => (
              <button key={prompt} onClick={() => sendMessage(prompt)} type="button" disabled={sending}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`assistant-message ${
                  message.role === "user" ? "is-user" : "is-assistant"
                } ${!message.content ? "is-thinking" : ""}`}
              >
                {message.content ? message.role === "assistant" ? (
                  <div
                    className={styles.assistantMarkdown}
                    dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(message.content) }}
                  />
                ) : message.content : (
                  <span className="assistant-typing" aria-label="正在输入">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {message.actions?.length ? (
                  <div className={styles.actionList} aria-label="相关页面">
                    {message.actions.map((action) => (
                      <Link href={action.href} key={`${action.kind}-${action.href}`} onClick={closeAssistant}>
                        <span>{action.label}</span>
                        <b aria-hidden="true">↗</b>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="assistant-input-row">
            <input
              ref={inputRef}
              value={input}
              placeholder="问问甘蔗：文章、相册、旅行地图..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) sendMessage();
              }}
            />

            <button
              onClick={sending ? stopResponse : () => sendMessage()}
              disabled={!sending && !input.trim()}
              type="button"
              aria-label={sending ? "停止生成" : "发送消息"}
            >
              {sending ? "停止" : "发送"}
            </button>
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        className={`assistant-avatar${open ? " is-open" : ""}`}
        onClick={() => open ? closeAssistant() : setOpen(true)}
        aria-label={open ? "收起聊天助手" : "打开聊天助手"}
        aria-expanded={open}
        type="button"
      >
        <span className="assistant-status-dot" />
        <div className="assistant-avatar-face" aria-hidden="true">
          <Image
            src="/assistant-avatar.png"
            alt=""
            width={1254}
            height={1254}
            draggable={false}
          />
        </div>

        <span className="assistant-bubble">{open ? "收起" : "问甘蔗"}</span>
      </button>
    </div>
  );
}
