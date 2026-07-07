"use client";

import { useState } from "react";

export function GuestbookForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const response = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, website, message, company }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "提交失败，请稍后重试。");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setWebsite("");
      setMessage("");
      setCompany("");
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
        onChange={(event) => setName(event.target.value)}
        maxLength={40}
        required
      />
      <input
        className="admin-input"
        name="email"
        type="email"
        placeholder="邮箱 *（不会公开，仅博主可见）"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        maxLength={100}
        required
      />
      <input
        className="admin-input"
        name="website"
        placeholder="你的网站（可选）"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        maxLength={180}
      />
      <input
        className="guestbook-honeypot"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        aria-hidden="true"
      />
      <textarea
        className="admin-input"
        name="message"
        placeholder="想说的话 *"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={500}
        required
      />

      {status === "error" && <p className="guestbook-error">{errorMsg}</p>}

      {status === "success" ? (
        <p className="guestbook-success">留言已提交，审核后会显示在页面上。</p>
      ) : (
        <button type="submit" className="admin-button" disabled={status === "loading"}>
          {status === "loading" ? "提交中..." : "发送留言"}
        </button>
      )}
    </form>
  );
}
