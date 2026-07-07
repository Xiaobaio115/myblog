"use client";

/* eslint-disable react-hooks/immutability */

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const quickPrompts = [
  "最近的文章有哪些？",
  "旅行地图在哪里？",
  "怎么打开 3D 照片墙？",
];

export default function VirtualAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "你好，我是甘蔗小助手。可以帮你找文章、相册、旅行地图和留言入口。",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  async function sendMessage(textFromButton?: string) {
    const text = (textFromButton || input).trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    const assistantIndex = nextMessages.length;

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "聊天失败，请稍后再试。");
      }

      if (!response.body) {
        throw new Error("当前浏览器不支持流式响应。");
      }

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
          };
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
      const message = error instanceof Error ? error.message : "聊天服务暂时有点小故障，可以稍后再试。";
      setMessages((currentMessages) => {
        const copiedMessages = [...currentMessages];
        copiedMessages[assistantIndex] = {
          role: "assistant",
          content: message,
        };
        return copiedMessages;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="virtual-assistant">
      {open && (
        <div className="assistant-panel" role="dialog" aria-label="甘蔗小助手">
          <div className="assistant-header">
            <div className="assistant-title-row">
              <span className="assistant-mini-avatar">甘</span>
              <div>
                <strong>甘蔗小助手</strong>
                <span>{sending ? "正在思考你的问题..." : "文章、相册、旅行地图都可以问我"}</span>
              </div>
            </div>

            <button onClick={() => setOpen(false)} type="button" aria-label="关闭聊天助手">
              ×
            </button>
          </div>

          <div className="assistant-quick-actions" aria-label="快捷问题">
            {quickPrompts.map((prompt) => (
              <button key={prompt} onClick={() => sendMessage(prompt)} type="button" disabled={sending}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="assistant-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`assistant-message ${
                  message.role === "user" ? "is-user" : "is-assistant"
                } ${!message.content ? "is-thinking" : ""}`}
              >
                {message.content || (
                  <span className="assistant-typing" aria-label="正在输入">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="assistant-input-row">
            <input
              value={input}
              placeholder="问问甘蔗：文章、相册、旅行地图..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
            />

            <button onClick={() => sendMessage()} disabled={sending || !input.trim()} type="button">
              {sending ? "..." : "发送"}
            </button>
          </div>
        </div>
      )}

      <button
        className={`assistant-avatar${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="打开聊天助手"
        type="button"
      >
        <span className="assistant-status-dot" />
        <div className="assistant-avatar-face">
          <span className="assistant-eye left" />
          <span className="assistant-eye right" />
          <span className="assistant-mouth" />
        </div>

        <span className="assistant-bubble">{open ? "收起" : "问甘蔗"}</span>
      </button>
    </div>
  );
}
