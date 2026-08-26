"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from "react";
import type {
  ProfileSetting,
  SocialItem,
  SkillGroup,
  SkillItem,
  EducationItem,
  ProjectItem,
  WorldSectionSetting,
  ContentSection,
  AllSettings,
} from "@/lib/settings";
import { adminFetch } from "@/lib/admin-api";
import { HomeHeroForm } from "./home-hero-form";
import { NavForm } from "./nav-form";
import { resolveNavItems } from "@/lib/nav-items";

type Tab = "profile" | "nav" | "homeHero" | "socials" | "skills" | "education" | "projects" | "world";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "👤 个人信息" },
  { key: "nav", label: "☰ 导航栏" },
  { key: "homeHero", label: "▣ 首页轮播" },
  { key: "socials", label: "🔗 社交链接" },
  { key: "skills", label: "🛠 技能栈" },
  { key: "education", label: "🎓 教育经历" },
  { key: "projects", label: "🚀 项目列表" },
  { key: "world", label: "🌍 世界分区" },
];

function normalizeSkillItem(item: SkillItem) {
  return typeof item === "string" ? { name: item, iconUrl: "" } : item;
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<AllSettings>("/api/settings", {
        fallbackError: "读取站点设置失败。",
      });
      setSettings(data);
      setMsg("");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "读取站点设置失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((item) => item.key === requested)) {
      queueMicrotask(() => setTab(requested as Tab));
    }
  }, []);

  async function saveSection(key: Tab, value: unknown) {
    setSaving(true);
    setMsg("");
    try {
      await adminFetch("/api/settings", {
        method: "PUT",
        json: { key, value },
        fallbackError: "保存站点设置失败。",
      });
      setMsg("保存成功！");
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "保存站点设置失败。");
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
              onClick={() => {
                setTab(t.key);
                setMsg("");
                const url = new URL(window.location.href);
                url.searchParams.set("tab", t.key);
                window.history.replaceState(null, "", url);
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {loading && <p className="admin-tip">加载中…</p>}
          {msg && <p className="settings-msg" role="status">{msg}</p>}
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
              {tab === "nav" && (
                <NavForm
                  // 走 resolveNavItems 而不是直接用返回值：老数据里没有的新入口能在后台直接看到。
                  value={resolveNavItems(settings.nav)}
                  saving={saving}
                  onChange={(v) => setSettings({ ...settings, nav: v })}
                  onSave={(v) => saveSection("nav", v)}
                />
              )}
              {tab === "homeHero" && (
                <HomeHeroForm
                  value={settings.homeHero ?? []}
                  saving={saving}
                  onChange={(v) => setSettings({ ...settings, homeHero: v })}
                  onSave={(v) => saveSection("homeHero", v)}
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
                <SkillsFormWithIcons
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

function SkillsFormWithIcons({ value, saving, onChange, onSave }: {
  value: SkillGroup[];
  saving: boolean;
  onChange: (v: SkillGroup[]) => void;
  onSave: (v: SkillGroup[]) => void;
}) {
  function updateItem(groupIndex: number, itemIndex: number, item: SkillItem) {
    const next = [...value];
    const group = next[groupIndex];
    const items = [...group.items];
    items[itemIndex] = item;
    next[groupIndex] = { ...group, items };
    onChange(next);
  }

  return (
    <div className="settings-col">
      <h2>技能栈</h2>
      <p className="settings-help">
        每个技术项都可以配置图标图片 URL，也可以直接上传图片到线上 Blob。部署后不会依赖本地文件。
      </p>

      {value.map((group, gi) => (
        <div key={gi} className="settings-skill-group">
          <div className="settings-row2">
            <input
              className="admin-input"
              placeholder="分组名称"
              value={group.group}
              onChange={(event) => {
                const next = [...value];
                next[gi] = { ...group, group: event.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="danger-btn"
              onClick={() => onChange(value.filter((_, i) => i !== gi))}
            >
              删除分组
            </button>
          </div>

          <div className="settings-skill-items">
            {group.items.map((rawItem, itemIndex) => {
              const item = normalizeSkillItem(rawItem);
              return (
                <div className="settings-skill-item-editor" key={`${item.name}-${itemIndex}`}>
                  <div className="settings-skill-icon-preview">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" />
                    ) : (
                      <span>{item.name.slice(0, 2).toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <input
                    className="admin-input"
                    placeholder="技术名称，如 React"
                    value={item.name}
                    onChange={(event) => updateItem(gi, itemIndex, { ...item, name: event.target.value })}
                  />
                  <input
                    className="admin-input"
                    placeholder="图标图片 URL，可粘贴 CDN / Blob 地址"
                    value={item.iconUrl ?? ""}
                    onChange={(event) => updateItem(gi, itemIndex, { ...item, iconUrl: event.target.value })}
                  />
                  <SettingsImageUploader
                    label="上传图标"
                    onUploaded={(iconUrl) => updateItem(gi, itemIndex, { ...item, iconUrl })}
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                      const next = [...value];
                      const items = [...group.items];
                      items.splice(itemIndex, 1);
                      next[gi] = { ...group, items };
                      onChange(next);
                    }}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="settings-add-btn"
            onClick={() => {
              const next = [...value];
              next[gi] = {
                ...group,
                items: [...group.items, { name: "新技术", iconUrl: "" }],
              };
              onChange(next);
            }}
          >
            + 添加技术项
          </button>
        </div>
      ))}

      <button
        type="button"
        className="settings-add-btn"
        onClick={() => onChange([...value, { group: "新分组", items: [] }])}
      >
        + 添加分组
      </button>
      <button className="admin-button" disabled={saving} onClick={() => onSave(value)}>
        {saving ? "保存中..." : "保存技能栈"}
      </button>
    </div>
  );
}

function SettingsImageUploader({ label, onUploaded }: { label: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload(file: File | null) {
    if (!file) return;

    const password = localStorage.getItem("admin_password") || "";
    if (!password) {
      setMessage("后台密码已丢失，请重新登录。");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    setMessage("");

    try {
      const data = await adminFetch<{ url?: string }>("/api/upload", {
        method: "POST",
        password,
        body: formData,
        fallbackError: "上传图片失败。",
      });

      const url = typeof data?.url === "string" ? data.url : "";
      if (!url) throw new Error("上传成功，但没有拿到图片 URL。");

      onUploaded(url);
      setMessage("已上传");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="secondary-link settings-upload-inline">
      {uploading ? "上传中..." : label}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={uploading}
        onChange={(event) => void handleUpload(event.target.files?.[0] || null)}
      />
      {message ? <span>{message}</span> : null}
    </label>
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

void SkillsForm;

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
              <label>标签（逗号分隔）</label>
              <input className="admin-input" placeholder="家乡,小城,美食" value={section.tags.join(",")}
                onChange={(e) => { const n = [...value]; n[i] = { ...section, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; onChange(n); }} />
            </div>

            <div>
              <label style={{ marginBottom: 10 }}>页面内容（文字 + 照片段落，按顺序展示）</label>
              {(section.sections ?? []).map((block, bi) => (
                <div key={bi} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 700 }}>段落 {bi + 1}</span>
                    <button type="button" style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#ef4444", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "2px 10px", cursor: "pointer" }}
                      onClick={() => { const n = [...value]; const blocks = [...(section.sections ?? [])]; blocks.splice(bi, 1); n[i] = { ...section, sections: blocks }; onChange(n); }}>删除段落</button>
                  </div>
                  <div className="settings-row2">
                    <div>
                      <label>文字描述（可留空）</label>
                      <textarea className="admin-input" rows={2} placeholder="这一段的描述文字…" value={block.caption}
                        onChange={(e) => { const n = [...value]; const blocks = [...(section.sections ?? [])]; blocks[bi] = { ...block, caption: e.target.value }; n[i] = { ...section, sections: blocks }; onChange(n); }} />
                    </div>
                    <div>
                      <label>关联标签（可留空，用于标签筛选）</label>
                      <input className="admin-input" placeholder="如 家乡" value={block.tag ?? ""}
                        onChange={(e) => { const n = [...value]; const blocks = [...(section.sections ?? [])]; blocks[bi] = { ...block, tag: e.target.value || undefined }; n[i] = { ...section, sections: blocks }; onChange(n); }} />
                    </div>
                  </div>
                  <div>
                    <label>照片（可不选）</label>
                    <PhotoPicker
                      selected={block.photos}
                      onChange={(photos) => { const n = [...value]; const blocks = [...(section.sections ?? [])]; blocks[bi] = { ...block, photos }; n[i] = { ...section, sections: blocks }; onChange(n); }}
                    />
                  </div>
                </div>
              ))}
              <button type="button" style={{ width: "100%", padding: "10px", border: "1px dashed var(--border)", borderRadius: 12, background: "transparent", color: "var(--text-soft)", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600 }}
                onClick={() => { const n = [...value]; const blocks = [...(section.sections ?? [])]; blocks.push({ caption: "", photos: [] } as ContentSection); n[i] = { ...section, sections: blocks }; onChange(n); }}>+ 添加段落</button>
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
  const [error, setError] = useState("");

  async function load() {
    if (photos.length) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<ApiPhoto[]>("/api/photos?limit=200", {
        fallbackError: "读取照片失败。",
      });
      setPhotos(Array.isArray(data) ? data : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取照片失败。");
    }
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
          {error && !loading && <p role="alert" style={{ color: "var(--danger-text)", gridColumn: "1/-1" }}>{error}</p>}
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
