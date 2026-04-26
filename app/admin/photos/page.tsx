/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";

type Photo = {
  _id: string;
  url: string;
  pathname?: string;
  caption: string;
  category: string;
  showIn3d?: boolean;
};

const DEFAULT_CATEGORIES = ["日常", "旅行", "风景", "美食", "截图", "灵感"];

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("日常");
  const [customCategory, setCustomCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const categories = useMemo(() => {
    const fromPhotos = photos.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromPhotos]));
  }, [photos]);

  async function loadPhotos() {
    const res = await fetch("/api/photos", { cache: "no-store" });
    if (res.ok) setPhotos(await res.json());
  }

  useEffect(() => { loadPhotos(); }, []);

  function handleFileChange(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function uploadPhoto() {
    if (!file) { alert("请先选择图片"); return; }

    const finalCategory = category === "自定义" ? customCategory.trim() : category;
    if (!finalCategory) { alert("请输入分类"); return; }

    const password = localStorage.getItem("admin_password") || "";
    setUploading(true);
    setUploadStatus("正在上传图片…");

    try {
      /* Step 1: upload file to Vercel Blob */
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-password": password },
        body: fd,
      });
      const upData = await upRes.json();
      if (!upRes.ok) { alert(upData.error || "图片上传失败"); return; }

      setUploadStatus("正在保存信息…");

      /* Step 2: save metadata to MongoDB */
      const metaRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "x-admin-password": password, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: upData.url,
          pathname: upData.pathname,
          caption: caption || "我的照片",
          category: finalCategory,
        }),
      });
      const metaData = await metaRes.json();
      if (!metaRes.ok) { alert(metaData.error || "保存失败"); return; }

      setCaption("");
      setFile(null);
      setPreview("");
      setUploadStatus("");
      await loadPhotos();
    } catch (e) {
      console.error(e);
      alert("上传失败，请检查网络或 Vercel 日志");
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("确定删除这张照片吗？")) return;
    const password = localStorage.getItem("admin_password") || "";
    const res = await fetch(`/api/photos/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    });
    if (!res.ok) { alert((await res.json()).error || "删除失败"); return; }
    setPhotos((prev) => prev.filter((p) => p._id !== id));
  }

  async function toggle3d(photo: Photo) {
    const password = localStorage.getItem("admin_password") || "";
    const next = !photo.showIn3d;
    setPhotos((prev) => prev.map((p) => p._id === photo._id ? { ...p, showIn3d: next } : p));
    const res = await fetch(`/api/photos/${photo._id}`, {
      method: "PATCH",
      headers: { "x-admin-password": password, "Content-Type": "application/json" },
      body: JSON.stringify({ showIn3d: next }),
    });
    if (!res.ok) {
      setPhotos((prev) => prev.map((p) => p._id === photo._id ? { ...p, showIn3d: photo.showIn3d } : p));
      alert("操作失败");
    }
  }

  const count3d = photos.filter((p) => p.showIn3d).length;

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">PHOTO MANAGER</div>
          <h1>相册管理</h1>
          <p>上传照片 · 管理分类 · 选择 3D 展示照片</p>
        </div>
      </div>

      <section className="photo-admin-layout">
        {/* ── 上传面板 ── */}
        <div className="photo-upload-panel">
          <h2>上传新照片</h2>

          <label className="photo-file-drop">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            {preview ? (
              <img src={preview} alt="预览" />
            ) : (
              <div>
                <span>📤</span>
                <p>点击选择图片</p>
                <small>JPG · PNG · WebP · GIF，最大 4MB</small>
              </div>
            )}
          </label>

          <input
            className="admin-input"
            placeholder="照片说明（可选）"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          <select
            className="admin-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
            <option value="自定义">+ 自定义分类</option>
          </select>

          {category === "自定义" && (
            <input
              className="admin-input"
              placeholder="输入新分类，例如 胶片"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          )}

          <button className="admin-button" onClick={uploadPhoto} disabled={uploading}>
            {uploading ? (uploadStatus || "上传中…") : "上传到相册"}
          </button>
        </div>

        {/* ── 已上传照片 ── */}
        <div className="photo-manage-panel">
          <h2>
            已上传照片
            <span className="photo-manage-count">{photos.length} 张</span>
            {count3d > 0 && (
              <span className="photo-manage-3d-badge">🎠 {count3d} 张加入 3D</span>
            )}
          </h2>

          {photos.length === 0 ? (
            <div className="empty-mini">还没有照片，先上传一张吧</div>
          ) : (
            <div className="photo-manage-list">
              {photos.map((photo) => (
                <div key={photo._id} className={`photo-manage-item ${photo.showIn3d ? "is-3d" : ""}`}>
                  <img src={photo.url} alt={photo.caption} />
                  <div>
                    <strong>{photo.caption}</strong>
                    <p>{photo.category}</p>
                  </div>
                  <div className="photo-manage-actions">
                    <button
                      className={`photo-3d-toggle ${photo.showIn3d ? "active" : ""}`}
                      onClick={() => toggle3d(photo)}
                      title={photo.showIn3d ? "从 3D 移除" : "加入 3D 星空"}
                    >
                      {photo.showIn3d ? "🎠 3D" : "+ 3D"}
                    </button>
                    <button className="photo-delete-btn" onClick={() => deletePhoto(photo._id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}