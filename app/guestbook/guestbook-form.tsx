"use client";

import { useState } from "react";

export function GuestbookForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, website, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "提交失败，请稍后重试。");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setWebsite("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMsg("网络错误，请稍后重试。");
    }
  }

  return (
    <form className="guestbook-form" onSubmit={handleSubmit}>
      <input
        className="admin-input"
        name="name"
        placeholder="你的昵称 *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div style={{ position: "relative" }}>
        <input
          className="admin-input"
          name="email"
          type="email"
          placeholder="邮箱 * （必填，不会公开，仅博主可见）"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%" }}
        />
      </div>
      <input
        className="admin-input"
        name="website"
        placeholder="你的网站（可选）"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <textarea
        className="admin-input"
        name="message"
        placeholder="想说的话 *"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />

      {status === "error" && (
        <p className="guestbook-error">{errorMsg}</p>
      )}

      {status === "success" ? (
        <p className="guestbook-success">留言已提交，感谢！刷新即可看到你的留言。</p>
      ) : (
        <button
          type="submit"
          className="admin-button"
          disabled={status === "loading"}
        >
          {status === "loading" ? "提交中…" : "发送留言"}
        </button>
      )}
    </form>
  );
}
