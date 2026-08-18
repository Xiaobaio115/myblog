"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import type { HomeHeroSlideSetting } from "@/lib/settings";

function createHomeHeroSlide(): HomeHeroSlideSetting {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `home-slide-${Date.now()}`,
    imageUrl: "",
    imageAlt: "首页轮播图片",
    eyebrow: "LQPP / FEATURED",
    title: "一段正在发生的故事",
    description: "",
    href: "/world",
    linkLabel: "继续浏览",
  };
}

function HeroImageUploader({ onUploaded }: { onUploaded: (imageUrl: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await adminFetch<{ url?: string }>("/api/upload", {
        method: "POST",
        body: formData,
        fallbackError: "上传轮播图片失败。",
      });
      const url = String(data.url || "").trim();
      if (!url) throw new Error("上传成功，但没有返回图片 URL。");
      onUploaded(url);
      setMessage("图片已上传。保存轮播后前台生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传轮播图片失败。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="secondary-link settings-upload-inline">
        {uploading ? "上传中..." : "上传轮播图片"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {message ? <p className="admin-tip" role="status">{message}</p> : null}
    </div>
  );
}

export function HomeHeroForm({ value, saving, onChange, onSave }: {
  value: HomeHeroSlideSetting[];
  saving: boolean;
  onChange: (value: HomeHeroSlideSetting[]) => void;
  onSave: (value: HomeHeroSlideSetting[]) => void;
}) {
  function update(index: number, patch: Partial<HomeHeroSlideSetting>) {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="settings-col">
      <div>
        <h2>轮播内容</h2>
        <p className="settings-help">按这里的顺序展示。支持本地上传、站内路径、CDN 或 Blob URL。</p>
      </div>

      {value.map((slide, index) => (
        <section key={slide.id} className="settings-list-item" aria-labelledby={`home-slide-title-${slide.id}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong id={`home-slide-title-${slide.id}`} style={{ marginRight: "auto" }}>轮播项 {index + 1}</strong>
            <button type="button" className="secondary-link" style={{ width: 40, minWidth: 40, minHeight: 40, padding: 0 }} disabled={index === 0} title="上移" aria-label={`将轮播项 ${index + 1} 上移`} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="secondary-link" style={{ width: 40, minWidth: 40, minHeight: 40, padding: 0 }} disabled={index === value.length - 1} title="下移" aria-label={`将轮播项 ${index + 1} 下移`} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className="danger-btn" style={{ width: 40, minWidth: 40, minHeight: 40, padding: 0 }} disabled={value.length <= 1} title={value.length <= 1 ? "至少保留一个轮播项" : "删除"} aria-label={`删除轮播项 ${index + 1}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>

          {slide.imageUrl ? <div style={{ overflow: "hidden", minHeight: 180, borderRadius: 8, background: "var(--surface-readable-soft)" }}><img src={slide.imageUrl} alt={slide.imageAlt || "轮播图片预览"} style={{ width: "100%", height: 220, objectFit: "cover" }} /></div> : null}

          <div className="settings-row2">
            <div><label>图片 URL</label><input className="admin-input" value={slide.imageUrl} placeholder="/images/hero.jpg 或 https://..." onChange={(event) => update(index, { imageUrl: event.target.value })} /></div>
            <div><label>图片替代文字</label><input className="admin-input" value={slide.imageAlt} placeholder="简洁描述图片内容" onChange={(event) => update(index, { imageAlt: event.target.value })} /></div>
          </div>
          <HeroImageUploader onUploaded={(imageUrl) => update(index, { imageUrl })} />

          <div className="settings-row2">
            <div><label>眉题</label><input className="admin-input" value={slide.eyebrow} placeholder="01 / FEATURED" onChange={(event) => update(index, { eyebrow: event.target.value })} /></div>
            <div><label>标题</label><input className="admin-input" value={slide.title} placeholder="轮播主标题" onChange={(event) => update(index, { title: event.target.value })} /></div>
          </div>
          <div><label>说明文字</label><textarea className="admin-input" rows={3} value={slide.description} placeholder="用一句话说明这一页" onChange={(event) => update(index, { description: event.target.value })} /></div>
          <div className="settings-row2">
            <div><label>按钮文字</label><input className="admin-input" value={slide.linkLabel} placeholder="继续浏览" onChange={(event) => update(index, { linkLabel: event.target.value })} /></div>
            <div><label>按钮链接</label><input className="admin-input" value={slide.href} placeholder="/world 或 https://..." onChange={(event) => update(index, { href: event.target.value })} /></div>
          </div>
        </section>
      ))}

      <button type="button" className="settings-add-btn" onClick={() => onChange([...value, createHomeHeroSlide()])}>+ 添加轮播项</button>
      <button className="admin-button" disabled={saving || value.length === 0} onClick={() => onSave(value)}>{saving ? "保存中..." : "保存首页轮播"}</button>
    </div>
  );
}
