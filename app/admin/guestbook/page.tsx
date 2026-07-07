"use client";

import { useCallback, useEffect, useState } from "react";

type GuestbookMsg = {
  _id: string;
  name: string;
  email: string;
  website: string;
  message: string;
  approved: boolean;
  ip: string;
  device: string;
  userAgent: string;
  createdAt: string;
  moderationStatus?: string;
};

function formatDate(value: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return value;
  }
}

export default function AdminGuestbookPage() {
  const [pw] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("admin_password") || ""
  );
  const [msgs, setMsgs] = useState<GuestbookMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async (password: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/guestbook", {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      setMsgs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pw) queueMicrotask(() => load(pw));
  }, [load, pw]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  }

  async function toggleApprove(id: string, current: boolean) {
    const res = await fetch("/api/guestbook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ id, approved: !current }),
    });

    if (res.ok) {
      setMsgs((prev) => prev.map((item) => (
        item._id === id ? { ...item, approved: !current } : item
      )));
      showToast(!current ? "已通过审核" : "已取消发布");
    } else {
      showToast("操作失败");
    }
  }

  async function deleteMsg(id: string) {
    if (!confirm("确定要删除这条留言吗？")) return;

    const res = await fetch("/api/guestbook", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setMsgs((prev) => prev.filter((item) => item._id !== id));
      showToast("已删除");
    } else {
      showToast("删除失败");
    }
  }

  const approved = msgs.filter((item) => item.approved);
  const pending = msgs.filter((item) => !item.approved);

  return (
    <main className="admin-dashboard">
      {toast && <div className="admin-toast">{toast}</div>}

      <div className="admin-page-head">
        <div>
          <div className="admin-badge">GUESTBOOK</div>
          <h1>留言管理</h1>
          <p>
            审核、查看访客信息、删除留言。共 {msgs.length} 条
            （待审核 {pending.length} / 已发布 {approved.length}）。
          </p>
        </div>
        <button className="admin-button" onClick={() => load(pw)} disabled={loading}>
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      {pending.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: "1rem", fontWeight: 700, color: "var(--pink-600)" }}>
            待审核（{pending.length}）
          </h2>
          <div style={{ display: "grid", gap: 16 }}>
            {pending.map((message) => (
              <MsgCard
                key={message._id}
                message={message}
                onApprove={() => toggleApprove(message._id, message.approved)}
                onDelete={() => deleteMsg(message._id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="admin-panel">
        <h2 style={{ marginBottom: 16, fontSize: "1rem", fontWeight: 700 }}>
          已发布（{approved.length}）
        </h2>
        {approved.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>暂无已发布留言。</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {approved.map((message) => (
              <MsgCard
                key={message._id}
                message={message}
                onApprove={() => toggleApprove(message._id, message.approved)}
                onDelete={() => deleteMsg(message._id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MsgCard({
  message,
  onApprove,
  onDelete,
}: {
  message: GuestbookMsg;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const [showUA, setShowUA] = useState(false);

  return (
    <div className={`admin-guestbook-card ${message.approved ? "approved" : "pending"}`}>
      <div className="admin-guestbook-card-head">
        <div className="admin-guestbook-meta">
          <strong>{message.name}</strong>
          {message.website && (
            <a href={message.website} target="_blank" rel="noopener noreferrer">
              {message.website}
            </a>
          )}
          <span className={`admin-status-pill ${message.approved ? "approved" : "pending"}`}>
            {message.approved ? "已发布" : "待审核"}
          </span>
        </div>
        <div className="admin-guestbook-actions">
          <button type="button" onClick={onApprove}>
            {message.approved ? "取消发布" : "通过"}
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>

      <p className="admin-guestbook-message">{message.message}</p>

      <div className="admin-guestbook-foot">
        <span>{formatDate(message.createdAt)}</span>
        {message.email && <span>{message.email}</span>}
        {message.ip && <span>IP: {message.ip}</span>}
        {message.device && <span>设备: {message.device}</span>}
        {message.userAgent && (
          <button type="button" onClick={() => setShowUA(!showUA)}>
            {showUA ? "收起 UA" : "查看 UA"}
          </button>
        )}
      </div>

      {showUA && message.userAgent && (
        <div className="admin-guestbook-ua">{message.userAgent}</div>
      )}
    </div>
  );
}
