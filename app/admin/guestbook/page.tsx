"use client";

import { useEffect, useState, useCallback } from "react";

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
};

function formatDate(s: string) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("zh-CN");
  } catch {
    return s;
  }
}

export default function AdminGuestbookPage() {
  const [pw, setPw] = useState("");
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
    const stored = localStorage.getItem("admin_password") || "";
    setPw(stored);
    if (stored) load(stored);
  }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function toggleApprove(id: string, current: boolean) {
    const res = await fetch("/api/guestbook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ id, approved: !current }),
    });
    if (res.ok) {
      setMsgs((prev) => prev.map((m) => m._id === id ? { ...m, approved: !current } : m));
      showToast(!current ? "✅ 已通过审核" : "⏸ 已取消审核");
    } else {
      showToast("❌ 操作失败");
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
      setMsgs((prev) => prev.filter((m) => m._id !== id));
      showToast("🗑 已删除");
    } else {
      showToast("❌ 删除失败");
    }
  }

  const approved = msgs.filter((m) => m.approved);
  const pending = msgs.filter((m) => !m.approved);

  return (
    <main className="admin-dashboard">
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: "#1e293b", color: "#f8fafc",
          padding: "10px 20px", borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: "0.92rem",
        }}>
          {toast}
        </div>
      )}

      <div className="admin-page-head">
        <div>
          <div className="admin-badge">GUESTBOOK</div>
          <h1>留言管理</h1>
          <p>审核、查看访客信息、删除留言。共 {msgs.length} 条（待审 {pending.length} / 已发布 {approved.length}）</p>
        </div>
        <button className="admin-button" onClick={() => load(pw)} disabled={loading}>
          {loading ? "加载中…" : "🔄 刷新"}
        </button>
      </div>

      {pending.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: "1rem", fontWeight: 700, color: "var(--pink-600)" }}>
            ⏳ 待审核 ({pending.length})
          </h2>
          <div style={{ display: "grid", gap: 16 }}>
            {pending.map((m) => (
              <MsgCard key={m._id} m={m} onApprove={() => toggleApprove(m._id, m.approved)} onDelete={() => deleteMsg(m._id)} />
            ))}
          </div>
        </section>
      )}

      <section className="admin-panel">
        <h2 style={{ marginBottom: 16, fontSize: "1rem", fontWeight: 700 }}>
          ✅ 已发布 ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>暂无已发布留言。</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {approved.map((m) => (
              <MsgCard key={m._id} m={m} onApprove={() => toggleApprove(m._id, m.approved)} onDelete={() => deleteMsg(m._id)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MsgCard({ m, onApprove, onDelete }: { m: GuestbookMsg; onApprove: () => void; onDelete: () => void }) {
  const [showUA, setShowUA] = useState(false);

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "16px 20px",
      background: m.approved ? "rgba(34,197,94,0.04)" : "rgba(251,191,36,0.06)",
      borderLeft: `3px solid ${m.approved ? "#22c55e" : "#f59e0b"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "0.95rem" }}>{m.name}</strong>
          {m.website && (
            <a href={m.website} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.78rem", color: "var(--pink-500)" }}>
              🔗 {m.website}
            </a>
          )}
          <span style={{
            fontSize: "0.72rem", padding: "2px 8px", borderRadius: "999px",
            background: m.approved ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.18)",
            color: m.approved ? "#16a34a" : "#b45309",
          }}>
            {m.approved ? "已发布" : "待审核"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onApprove}
            style={{
              padding: "4px 14px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
            }}>
            {m.approved ? "取消发布" : "✅ 通过"}
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: "4px 14px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer",
              border: "1px solid #ef4444", background: "transparent", color: "#ef4444",
            }}>
            🗑 删除
          </button>
        </div>
      </div>

      <p style={{ margin: "8px 0 12px", lineHeight: 1.7, fontSize: "0.95rem" }}>{m.message}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: "0.78rem", color: "var(--muted)" }}>
        <span>🕐 {formatDate(m.createdAt)}</span>
        {m.email && <span>📧 {m.email}</span>}
        {m.ip && <span>🌐 IP: {m.ip}</span>}
        {m.device && <span>📱 设备: {m.device}</span>}
        {m.userAgent && (
          <button
            onClick={() => setShowUA(!showUA)}
            style={{ background: "none", border: "none", color: "var(--pink-500)", cursor: "pointer", fontSize: "0.78rem", padding: 0 }}>
            {showUA ? "▲ 收起 UA" : "▼ 查看 UA"}
          </button>
        )}
      </div>
      {showUA && m.userAgent && (
        <div style={{
          marginTop: 8, padding: "8px 12px", borderRadius: 8,
          background: "rgba(0,0,0,0.06)", fontSize: "0.72rem",
          color: "var(--text-soft)", wordBreak: "break-all", lineHeight: 1.6,
        }}>
          {m.userAgent}
        </div>
      )}
    </div>
  );
}
