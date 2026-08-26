"use client";

import { useEffect, useState } from "react";
import { adminFetch, getAdminPassword } from "@/lib/admin-api";
import { SERIES_CATEGORIES, type SeriesMeta } from "@/lib/series";

const CATEGORY_OPTIONS = Object.entries(SERIES_CATEGORIES);
const CATEGORY_COLORS: Record<string, string> = {
  travel: "#f59e0b",
  tech: "#3b82f6",
  coding: "#8b5cf6",
  life: "#10b981",
};

function emptyMeta(): SeriesMeta {
  return { name: "", category: "life", description: "", cover: "", sortOrder: 0 };
}

export function SeriesMetaEditor() {
  const [metas, setMetas] = useState<SeriesMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState<SeriesMeta>(emptyMeta());
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch<SeriesMeta[]>("/api/series", {
        fallbackError: "读取系列元数据失败。",
      });
      setMetas(Array.isArray(data) ? data : []);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "读取系列元数据失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  function startEdit(meta: SeriesMeta) {
    setEditingName(meta.name);
    setAdding(false);
    setEditForm({ ...meta });
    setMsg("");
  }

  function startAdd() {
    setAdding(true);
    setEditingName(null);
    setEditForm(emptyMeta());
    setMsg("");
  }

  function cancelEdit() {
    setEditingName(null);
    setAdding(false);
    setEditForm(emptyMeta());
  }

  async function saveEdit() {
    const name = editForm.name.trim();
    if (!name) {
      setMsg("系列名称不能为空。");
      return;
    }

    const password = getAdminPassword();
    if (!password) {
      setMsg("后台密码已丢失，请重新进入后台。");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      await adminFetch("/api/series", {
        method: "POST",
        password,
        json: {
          name,
          category: editForm.category,
          description: editForm.description,
          cover: editForm.cover,
          sortOrder: editForm.sortOrder,
        },
        fallbackError: "保存系列元数据失败。",
      });
      await load();
      cancelEdit();
      setMsg("保存成功。");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "保存系列元数据失败。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMeta(name: string) {
    if (!confirm(`确定删除系列「${name}」的元数据吗？不会影响系列下的文章。`)) {
      return;
    }

    const password = getAdminPassword();
    if (!password) {
      setMsg("后台密码已丢失，请重新进入后台。");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      await adminFetch("/api/series", {
        method: "DELETE",
        password,
        json: { name },
        fallbackError: "删除系列元数据失败。",
      });
      await load();
      setMsg("已删除。");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "删除系列元数据失败。");
    } finally {
      setSaving(false);
    }
  }

  const metaByName = new Map(metas.map((m) => [m.name, m]));

  return (
    <section style={{ marginBottom: 40 }}>
      <div className="admin-page-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="admin-badge">SERIES META</div>
          <h1>系列元数据</h1>
          <p>为系列设置分类、封面、简介和排序。系列元数据独立于文章，删除不影响文章。</p>
        </div>
        <div>
          <button type="button" className="admin-button" onClick={startAdd} disabled={adding || saving}>
            新建系列元数据
          </button>
        </div>
      </div>

      {msg ? <div className="settings-msg" role="status">{msg}</div> : null}

      {loading && <p style={{ color: "var(--text-soft)" }}>加载中…</p>}

      {/* Add / Edit inline form */}
      {(adding || editingName) && (
        <div style={{ border: "2px solid var(--border)", borderRadius: 20, padding: 20, marginBottom: 20, background: "var(--surface)" }}>
          <h3 style={{ margin: "0 0 16px" }}>{adding ? "新建系列" : `编辑「${editingName}」`}</h3>
          <div className="settings-col">
            <div className="settings-row2">
              <div>
                <label>系列名称</label>
                <input
                  className="admin-input"
                  placeholder="与文章上的系列名称一致"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  disabled={!!editingName}
                />
                {editingName ? <small style={{ color: "var(--text-soft)" }}>名称不可修改，如需改名请删除后新建。</small> : null}
              </div>
              <div>
                <label>分类</label>
                <select
                  className="admin-input"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as SeriesMeta["category"] })}
                >
                  {CATEGORY_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>封面图 URL</label>
              <input
                className="admin-input"
                placeholder="https://..."
                value={editForm.cover}
                onChange={(e) => setEditForm({ ...editForm, cover: e.target.value })}
              />
            </div>
            <div>
              <label>简介</label>
              <textarea
                className="admin-input"
                rows={2}
                placeholder="一句话描述这个系列"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <label>排序（数字越小越靠前）</label>
              <input
                className="admin-input"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={editForm.sortOrder}
                onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) || 0 })}
                style={{ maxWidth: 160 }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" className="admin-button" onClick={saveEdit} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
              <button type="button" className="secondary-link" onClick={cancelEdit}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* List of existing metas */}
      {metas.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {metas.map((meta) => (
            <div
              key={meta.name}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--surface)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: CATEGORY_COLORS[meta.category] || CATEGORY_COLORS.life,
                  whiteSpace: "nowrap",
                }}
              >
                {SERIES_CATEGORIES[meta.category] || meta.category}
              </span>
              <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {meta.name}
              </strong>
              {meta.cover ? (
                <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>有封面</span>
              ) : (
                <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>无封面</span>
              )}
              <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>排序 {meta.sortOrder}</span>
              <button
                type="button"
                className="secondary-link"
                onClick={() => startEdit(meta)}
                style={{ fontSize: "0.82rem" }}
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => deleteMeta(meta.name)}
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  background: "none",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  padding: "2px 10px",
                  cursor: "pointer",
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && metas.length === 0 && !adding && (
        <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-soft)" }}>
          <p>还没有系列元数据。点击「新建系列元数据」开始配置。</p>
        </div>
      )}
    </section>
  );
}