"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  ProfileSetting,
  SocialItem,
  SkillGroup,
  EducationItem,
  ProjectItem,
  TravelItem,
  GameItem,
  WorldSectionSetting,
  AllSettings,
} from "@/lib/settings";

type Tab = "profile" | "socials" | "skills" | "education" | "projects" | "travel" | "games" | "world";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "👤 个人信息" },
  { key: "socials", label: "🔗 社交链接" },
  { key: "skills", label: "🛠 技能栈" },
  { key: "education", label: "🎓 教育经历" },
  { key: "projects", label: "🚀 项目列表" },
  { key: "travel", label: "✈️ 旅行目的地" },
  { key: "games", label: "🎮 游戏列表" },
  { key: "world", label: "🌍 世界分区" },
];

export default function AdminSettingsPage() {
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState<Tab>("profile");
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data as AllSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("admin_password") || "";
    setPw(stored);
    load();
  }, [load]);

  async function saveSection(key: Tab, value: unknown) {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-password": pw },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg("❌ " + (data.error || "保存失败")); return; }
      setMsg("✅ 保存成功！");
      load();
    } catch {
      setMsg("❌ 网络错误");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">SETTINGS</div>
          <h1>站点设置</h1>
          <p>修改个人信息、技能、项目、旅行、游戏等内容，保存后前台实时生效。</p>
        </div>
      </div>

      <div className="settings-shell">
        <nav className="settings-tab-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`settings-tab-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => { setTab(t.key); setMsg(""); }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {loading && <p className="admin-tip">加载中…</p>}
          {msg && <p className="settings-msg">{msg}</p>}
          {!loading && settings && (
            <>
              {tab === "profile" && (
                <ProfileForm
                  value={settings.profile}
                  saving={saving}
                  onChange={(v) => setSettings({ ...settings, profile: v })}
                  onSave={(v) => saveSection("profile", v)}
                />
              )}
              {tab === "socials" && (
                <ListForm<SocialItem>
                  label="社交链接"
                  items={settings.socials}
                  saving={saving}
                  empty={{ label: "", value: "", href: "" }}
                  renderItem={(item, onChange) => (
                    <div className="settings-row3">
                      <input className="admin-input" placeholder="平台名" value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} />
                      <input className="admin-input" placeholder="显示文字" value={item.value} onChange={(e) => onChange({ ...item, value: e.target.value })} />
                      <input className="admin-input" placeholder="链接 URL" value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} />
                    </div>
                  )}
                  onChange={(v) => setSettings({ ...settings, socials: v })}
                  onSave={(v) => saveSection("socials", v)}
                />
              )}
              {tab === "skills" && (
                <SkillsForm
                  value={settings.skills}
                  saving={saving}
                  onChange={(v) => setSettings({ ...settings, skills: v })}
                  onSave={(v) => saveSection("skills", v)}
                />
              )}
              {tab === "education" && (
                <ListForm<EducationItem>
                  label="教育经历"
                  items={settings.education}
                  saving={saving}
                  empty={{ time: "", title: "", desc: "", tags: [] }}
                  renderItem={(item, onChange) => (
                    <div className="settings-col">
                      <div className="settings-row2">
                        <input className="admin-input" placeholder="时间（如 2021 - 至今）" value={item.time} onChange={(e) => onChange({ ...item, time: e.target.value })} />
                        <input className="admin-input" placeholder="学校 / 专业" value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} />
                      </div>
                      <textarea className="admin-input" placeholder="描述" rows={2} value={item.desc} onChange={(e) => onChange({ ...item, desc: e.target.value })} />
                      <input className="admin-input" placeholder="标签，用逗号分隔" value={item.tags.join(",")} onChange={(e) => onChange({ ...item, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                  )}
                  onChange={(v) => setSettings({ ...settings, education: v })}
                  onSave={(v) => saveSection("education", v)}
                />
              )}
              {tab === "projects" && (
                <ListForm<ProjectItem>
                  label="项目"
                  items={settings.projects}
                  saving={saving}
                  empty={{ title: "", status: "规划中", desc: "", stack: [], href: "" }}
                  renderItem={(item, onChange) => (
                    <div className="settings-col">
                      <div className="settings-row2">
                        <input className="admin-input" placeholder="项目名称" value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} />
                        <input className="admin-input" placeholder="状态（进行中/已上线/规划中）" value={item.status} onChange={(e) => onChange({ ...item, status: e.target.value })} />
                      </div>
                      <textarea className="admin-input" placeholder="描述" rows={2} value={item.desc} onChange={(e) => onChange({ ...item, desc: e.target.value })} />
                      <div className="settings-row2">
                        <input className="admin-input" placeholder="技术栈，逗号分隔" value={item.stack.join(",")} onChange={(e) => onChange({ ...item, stack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                        <input className="admin-input" placeholder="链接 href" value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} />
                      </div>
                    </div>
                  )}
                  onChange={(v) => setSettings({ ...settings, projects: v })}
                  onSave={(v) => saveSection("projects", v)}
                />
              )}
              {tab === "travel" && (
                <ListForm<TravelItem>
                  label="旅行目的地"
                  items={settings.travel}
                  saving={saving}
                  empty={{ id: "", name: "", date: "", desc: "", cover: "", photos: [], tags: [] }}
                  renderItem={(item, onChange) => (
                    <div className="settings-col">
                      <div className="settings-row3">
                        <input className="admin-input" placeholder="ID（英文，如 yunnan-dali）" value={item.id} onChange={(e) => onChange({ ...item, id: e.target.value })} />
                        <input className="admin-input" placeholder="名称（如 云南·大理）" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
                        <input className="admin-input" placeholder="日期（如 2025.08）" value={item.date} onChange={(e) => onChange({ ...item, date: e.target.value })} />
                      </div>
                      <textarea className="admin-input" placeholder="描述" rows={2} value={item.desc} onChange={(e) => onChange({ ...item, desc: e.target.value })} />
                      <div className="settings-row2">
                        <input className="admin-input" placeholder="封面图 URL" value={item.cover} onChange={(e) => onChange({ ...item, cover: e.target.value })} />
                        <input className="admin-input" placeholder="标签，逗号分隔" value={item.tags.join(",")} onChange={(e) => onChange({ ...item, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                      </div>
                      <PhotoPicker
                        selected={item.photos ?? []}
                        onChange={(photos) => onChange({ ...item, photos })}
                      />
                    </div>
                  )}
                  onChange={(v) => setSettings({ ...settings, travel: v })}
                  onSave={(v) => saveSection("travel", v)}
                />
              )}
              {tab === "games" && (
                <ListForm<GameItem>
                  label="游戏"
                  items={settings.games}
                  saving={saving}
                  empty={{ id: "", name: "", type: "", date: "", desc: "", cover: "", tags: [] }}
                  renderItem={(item, onChange) => (
                    <div className="settings-col">
                      <div className="settings-row3">
                        <input className="admin-input" placeholder="ID（英文）" value={item.id} onChange={(e) => onChange({ ...item, id: e.target.value })} />
                        <input className="admin-input" placeholder="游戏名" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
                        <input className="admin-input" placeholder="类型" value={item.type} onChange={(e) => onChange({ ...item, type: e.target.value })} />
                      </div>
                      <div className="settings-row2">
                        <input className="admin-input" placeholder="时间（如 2020 至今）" value={item.date} onChange={(e) => onChange({ ...item, date: e.target.value })} />
                        <input className="admin-input" placeholder="封面图 URL" value={item.cover} onChange={(e) => onChange({ ...item, cover: e.target.value })} />
                      </div>
                      <textarea className="admin-input" placeholder="描述" rows={2} value={item.desc} onChange={(e) => onChange({ ...item, desc: e.target.value })} />
                      <input className="admin-input" placeholder="标签，逗号分隔" value={item.tags.join(",")} onChange={(e) => onChange({ ...item, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                  )}
                  onChange={(v) => setSettings({ ...settings, games: v })}
                  onSave={(v) => saveSection("games", v)}
                />
              )}
              {tab === "world" && (
                <WorldSectionsForm
                  value={settings.world ?? []}
                  saving={saving}
                  onChange={(v) => setSettings({ ...settings, world: v })}
                  onSave={(v) => saveSection("world", v)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ProfileForm({ value, saving, onChange, onSave }: {
  value: ProfileSetting;
  saving: boolean;
  onChange: (v: ProfileSetting) => void;
  onSave: (v: ProfileSetting) => void;
}) {
  const f = (field: keyof ProfileSetting) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [field]: e.target.value });
  return (
    <div className="settings-col">
      <h2>个人信息</h2>
      <div className="settings-row2">
        <div><label>昵称</label><input className="admin-input" value={value.name} onChange={f("name")} /></div>
        <div><label>头像 URL</label><input className="admin-input" placeholder="留空则显示文字" value={value.avatarUrl} onChange={f("avatarUrl")} /></div>
      </div>
      <div><label>个性签名</label><input className="admin-input" value={value.tagline} onChange={f("tagline")} /></div>
      <div><label>简介</label><textarea className="admin-input" rows={3} value={value.intro} onChange={f("intro")} /></div>
      <div className="settings-row2">
        <div><label>当前状态</label><input className="admin-input" placeholder="如：正在建设数字花园" value={value.status} onChange={f("status")} /></div>
        <div><label>所在地</label><input className="admin-input" placeholder="如：中国 · 地球在线" value={value.location} onChange={f("location")} /></div>
      </div>
      <div className="settings-row2">
        <div><label>邮箱</label><input className="admin-input" type="email" value={value.email} onChange={f("email")} /></div>
        <div><label>GitHub URL</label><input className="admin-input" value={value.githubUrl} onChange={f("githubUrl")} /></div>
      </div>
      <button className="admin-button" disabled={saving} onClick={() => onSave(value)}>
        {saving ? "保存中…" : "保存个人信息"}
      </button>
    </div>
  );
}

function SkillsForm({ value, saving, onChange, onSave }: {
  value: SkillGroup[];
  saving: boolean;
  onChange: (v: SkillGroup[]) => void;
  onSave: (v: SkillGroup[]) => void;
}) {
  return (
    <div className="settings-col">
      <h2>技能栈</h2>
      {value.map((group, gi) => (
        <div key={gi} className="settings-skill-group">
          <div className="settings-row2">
            <input
              className="admin-input"
              placeholder="分组名称"
              value={group.group}
              onChange={(e) => {
                const next = [...value];
                next[gi] = { ...group, group: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="danger-btn"
              onClick={() => onChange(value.filter((_, i) => i !== gi))}
            >删除分组</button>
          </div>
          <input
            className="admin-input"
            placeholder="技能，逗号分隔"
            value={group.items.join(",")}
            onChange={(e) => {
              const next = [...value];
              next[gi] = { ...group, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
              onChange(next);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="settings-add-btn"
        onClick={() => onChange([...value, { group: "新分组", items: [] }])}
      >+ 添加分组</button>
      <button className="admin-button" disabled={saving} onClick={() => onSave(value)}>
        {saving ? "保存中…" : "保存技能栈"}
      </button>
    </div>
  );
}

function WorldSectionsForm({ value, saving, onChange, onSave }: {
  value: WorldSectionSetting[];
  saving: boolean;
  onChange: (v: WorldSectionSetting[]) => void;
  onSave: (v: WorldSectionSetting[]) => void;
}) {
  return (
    <div className="settings-col">
      <h2>世界分区</h2>
      <p style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
        修改「我的世界」页面四个分区的封面图、标题、描述、标签。ID 和跳转链接固定不可改。
      </p>
      {value.map((section, i) => (
        <div key={section.id} className="settings-list-item" style={{ border: "2px solid var(--border)", borderRadius: 20, padding: 20, marginBottom: 8 }}>
          <div className="settings-col">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: "1.4rem" }}>{section.icon}</span>
              <strong style={{ fontSize: "1rem" }}>{section.title}</strong>
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-soft)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "2px 8px" }}>ID: {section.id}</span>
            </div>
            <div className="settings-row3">
              <div>
                <label>图标 Emoji</label>
                <input className="admin-input" placeholder="如 🏡" value={section.icon}
                  onChange={(e) => { const n = [...value]; n[i] = { ...section, icon: e.target.value }; onChange(n); }} />
              </div>
              <div>
                <label>眉题 (Eyebrow)</label>
                <input className="admin-input" placeholder="如 Hometown" value={section.eyebrow}
                  onChange={(e) => { const n = [...value]; n[i] = { ...section, eyebrow: e.target.value }; onChange(n); }} />
              </div>
              <div>
                <label>标题</label>
                <input className="admin-input" value={section.title}
                  onChange={(e) => { const n = [...value]; n[i] = { ...section, title: e.target.value }; onChange(n); }} />
              </div>
            </div>
            <div>
              <label>封面图 URL（留空使用图标）</label>
              <input className="admin-input" placeholder="https://..." value={section.cover}
                onChange={(e) => { const n = [...value]; n[i] = { ...section, cover: e.target.value }; onChange(n); }} />
            </div>
            <div>
              <label>描述</label>
              <textarea className="admin-input" rows={2} value={section.desc}
                onChange={(e) => { const n = [...value]; n[i] = { ...section, desc: e.target.value }; onChange(n); }} />
            </div>
            <div>
              <label>标签（逗号分隔）</label>
              <input className="admin-input" placeholder="家乡,小城,美食" value={section.tags.join(",")}
                onChange={(e) => { const n = [...value]; n[i] = { ...section, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; onChange(n); }} />
            </div>
            <div>
              <label>页面照片（从相册选择）</label>
              <PhotoPicker
                selected={section.photos ?? []}
                onChange={(photos) => { const n = [...value]; n[i] = { ...section, photos }; onChange(n); }}
              />
            </div>
          </div>
        </div>
      ))}
      <button className="admin-button" disabled={saving} onClick={() => onSave(value)}>
        {saving ? "保存中…" : "保存世界分区"}
      </button>
    </div>
  );
}

function ListForm<T>({ label, items, saving, empty, renderItem, onChange, onSave }: {
  label: string;
  items: T[];
  saving: boolean;
  empty: T;
  renderItem: (item: T, onChange: (v: T) => void) => React.ReactNode;
  onChange: (v: T[]) => void;
  onSave: (v: T[]) => void;
}) {
  return (
    <div className="settings-col">
      <h2>{label}</h2>
      {items.map((item, i) => (
        <div key={i} className="settings-list-item">
          {renderItem(item, (v) => {
            const next = [...items];
            next[i] = v;
            onChange(next);
          })}
          <button
            type="button"
            className="danger-btn"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >删除</button>
        </div>
      ))}
      <button
        type="button"
        className="settings-add-btn"
        onClick={() => onChange([...items, { ...empty }])}
      >+ 添加{label}</button>
      <button className="admin-button" disabled={saving} onClick={() => onSave(items)}>
        {saving ? "保存中…" : `保存${label}`}
      </button>
    </div>
  );
}

type ApiPhoto = { _id: string; url?: string; caption?: string };

function PhotoPicker({ selected, onChange }: {
  selected: string[];
  onChange: (photos: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (photos.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/photos?limit=200");
      const data = await res.json() as ApiPhoto[];
      setPhotos(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function toggle(url: string) {
    if (selected.includes(url)) {
      onChange(selected.filter((u) => u !== url));
    } else {
      onChange([...selected, url]);
    }
  }

  return (
    <div className="settings-col" style={{ gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-soft)", fontWeight: 700 }}>
          已选照片 {selected.length} 张
        </span>
        <button
          type="button"
          className="settings-add-btn"
          onClick={() => { setOpen((v) => !v); if (!open) load(); }}
          style={{ minHeight: 36, padding: "0 14px", fontSize: "0.82rem" }}
        >
          {open ? "收起" : "从相册选择照片"}
        </button>
      </div>

      {selected.length > 0 && (
        <div className="photo-picker-selected">
          {selected.map((url) => (
            <div key={url} className="photo-picker-thumb" onClick={() => toggle(url)}>
              <img src={url} alt="" />
              <span className="photo-picker-remove">✕</span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="photo-picker-grid">
          {loading && <p style={{ color: "var(--text-soft)", gridColumn: "1/-1" }}>加载中…</p>}
          {!loading && photos.length === 0 && (
            <p style={{ color: "var(--text-soft)", gridColumn: "1/-1" }}>暂无上传的照片</p>
          )}
          {photos.map((photo) => {
            const url = photo.url ?? "";
            const isSelected = selected.includes(url);
            return (
              <div
                key={photo._id}
                className={`photo-picker-thumb ${isSelected ? "selected" : ""}`}
                onClick={() => toggle(url)}
                title={photo.caption ?? ""}
              >
                <img src={url} alt={photo.caption ?? ""} />
                {isSelected && <span className="photo-picker-check">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
