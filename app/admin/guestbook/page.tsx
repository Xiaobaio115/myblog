"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

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
  const [msgs, setMsgs] = useState<GuestbookMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<GuestbookMsg[]>("/api/guestbook", {
        fallbackError: "读取留言失败。",
      });
      setMsgs(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "读取留言失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function toggleApprove(id: string, current: boolean) {
    if (busyId) return;
    setBusyId(id);
    try {
      await adminFetch("/api/guestbook", {
        method: "PATCH",
        json: { id, approved: !current },
        fallbackError: "审核操作失败。",
      });
      setMsgs((prev) => prev.map((item) => (
        item._id === id ? { ...item, approved: !current } : item
      )));
      showToast(!current ? "已通过审核" : "已取消发布");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusyId("");
    }
  }

  async function deleteMsg(id: string) {
    if (busyId) return;
    if (!confirm("确定要删除这条留言吗？")) return;

    setBusyId(id);
    try {
      await adminFetch("/api/guestbook", {
        method: "DELETE",
        json: { id },
        fallbackError: "删除留言失败。",
      });
      setMsgs((prev) => prev.filter((item) => item._id !== id));
      showToast("已删除");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusyId("");
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
        <button className="admin-button" onClick={() => void load()} disabled={loading}>
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      {loading ? <section className="admin-panel" role="status"><p>正在读取留言...</p></section> : null}

      {!loading && pending.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: "1rem", fontWeight: 700, color: "var(--pink-600)" }}>
            待审核（{pending.length}）
          </h2>
          <div style={{ display: "grid", gap: 16 }}>
            {pending.map((message) => (
              <MsgCard
                key={message._id}
                message={message}
                busy={busyId === message._id}
                onApprove={() => void toggleApprove(message._id, message.approved)}
                onDelete={() => deleteMsg(message._id)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading ? <section className="admin-panel">
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
                busy={busyId === message._id}
                onApprove={() => void toggleApprove(message._id, message.approved)}
                onDelete={() => deleteMsg(message._id)}
              />
            ))}
          </div>
        )}
      </section> : null}
    </main>
  );
}

function MsgCard({
  message,
  onApprove,
  onDelete,
  busy,
}: {
  message: GuestbookMsg;
  onApprove: () => void;
  onDelete: () => void;
  busy: boolean;
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
          <button type="button" onClick={onApprove} disabled={busy}>
            {busy ? "处理中..." : message.approved ? "取消发布" : "通过"}
          </button>
          <button type="button" className="danger" onClick={onDelete} disabled={busy}>
            {busy ? "处理中..." : "删除"}
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
