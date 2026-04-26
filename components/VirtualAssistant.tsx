"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function VirtualAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "你好呀，我是甘蔗。简单问题我会直接回答，复杂问题每天可以问我 10 次。",
    },
  ]);

  async function sendMessage(textFromButton?: string) {
    const text = (textFromButton || input).trim();

    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: text,
      },
    ];

    const assistantIndex = nextMessages.length;

    setMessages([
      ...nextMessages,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "聊天失败");
      }

      if (!res.body) {
        throw new Error("浏览器不支持流式响应");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let fullReply = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullReply += chunk;

        setMessages((currentMessages) => {
          const copiedMessages = [...currentMessages];

          copiedMessages[assistantIndex] = {
            role: "assistant",
            content: fullReply || "甘蔗正在回复...",
          };

          return copiedMessages;
        });
      }

      if (!fullReply.trim()) {
        setMessages((currentMessages) => {
          const copiedMessages = [...currentMessages];

          copiedMessages[assistantIndex] = {
            role: "assistant",
            content: "我刚刚没有收到有效回复，可以再问一次吗？",
          };

          return copiedMessages;
        });
      }
    } catch (error: any) {
      setMessages((currentMessages) => {
        const copiedMessages = [...currentMessages];

        copiedMessages[assistantIndex] = {
          role: "assistant",
          content:
            error?.message || "聊天服务暂时有点小故障，可以稍后再试。",
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
        <div className="assistant-panel">
          <div className="assistant-header">
            <div>
              <strong>甘蔗助手</strong>
              <span>简单问题不消耗 AI 次数</span>
            </div>

            <button onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="assistant-quick-actions">
            <button onClick={() => sendMessage("相册在哪里？")}>相册</button>
            <button onClick={() => sendMessage("3D照片墙怎么打开？")}>
              3D照片墙
            </button>
            <button onClick={() => sendMessage("后台入口在哪里？")}>
              后台
            </button>
          </div>

          <div className="assistant-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`assistant-message ${
                  message.role === "user" ? "is-user" : "is-assistant"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="assistant-input-row">
            <input
              value={input}
              placeholder="和甘蔗说点什么..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
            />

            <button onClick={() => sendMessage()} disabled={sending}>
              发送
            </button>
          </div>
        </div>
      )}

      <button
        className="assistant-avatar"
        onClick={() => setOpen((value) => !value)}
        aria-label="打开聊天助手"
      >
        <div className="assistant-avatar-face">
          <span className="assistant-eye left" />
          <span className="assistant-eye right" />
          <span className="assistant-mouth" />
        </div>

        <span className="assistant-bubble">聊聊</span>
      </button>
    </div>
  );
}
