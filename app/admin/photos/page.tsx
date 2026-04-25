"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Photo = {
  _id: string;
  url: string;
  pathname?: string;
  caption: string;
  category: string;
  isPrivate?: boolean;
  createdAt?: string;
};

const DEFAULT_CATEGORIES = ["日常", "旅行", "风景", "美食", "截图", "灵感"];

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

function buildSafeFilename(file: File, category: string) {
  const safeCategory = category.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, "");
  const safeName = file.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return `photos/${safeCategory || "default"}/${Date.now()}-${safeName || "image.jpg"}`;
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("日常");
  const [customCategory, setCustomCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busyPhotoId, setBusyPhotoId] = useState("");

  const categories = useMemo(() => {
    const fromPhotos = photos.map((photo) => photo.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromPhotos]));
  }, [photos]);

  useEffect(() => {
    void loadPhotos();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  async function loadPhotos() {
    try {
      const response = await fetch("/api/photos", {
        cache: "no-store",
      });
      const data = await parseJsonSafely(response);

      if (response.ok && Array.isArray(data)) {
        setPhotos(data as unknown as Photo[]);
      }
    } catch (error) {
      console.error("load photos failed:", error);
    }
  }

  function handleFileChange(selectedFile: File | null) {
    setFile(selectedFile);

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    if (!selectedFile) {
      setPreview("");
      return;
    }

    setPreview(URL.createObjectURL(selectedFile));
  }

  async function uploadPhoto() {
    if (!file) {
      setMessage("请先选择图片。");
      return;
    }

    const finalCategory = category === "__custom__" ? customCategory.trim() : category;

    if (!finalCategory) {
      setMessage("请输入分类。");
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setMessage("");

    try {
      const blob = await upload(buildSafeFilename(file, finalCategory), file, {
        access: "public",
        handleUploadUrl: "/api/photos/upload",
        headers: {
          "x-admin-password": password,
        },
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(Math.round(percentage));
        },
      });

      const response = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          url: blob.url,
          pathname: blob.pathname,
          caption: caption.trim() || "我的照片",
          category: finalCategory,
          isPrivate,
        }),
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "保存相册信息失败。"
        );
      }

      setCaption("");
      setCategory(finalCategory);
      setCustomCategory("");
      setIsPrivate(false);
      setFile(null);
      setPreview("");
      setUploadProgress(0);
      setMessage("图片已上传到相册。");

      if (data?.photo) {
        setPhotos((current) => [data.photo as unknown as Photo, ...current]);
      } else {
        await loadPhotos();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setUploading(false);
    }
  }

  async function togglePrivate(photo: Photo) {
    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");

    try {
      const response = await fetch(`/api/photos/${photo._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          isPrivate: !photo.isPrivate,
        }),
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "更新照片失败。"
        );
      }

      setPhotos((current) =>
        current.map((item) =>
          item._id === photo._id
            ? { ...item, isPrivate: !photo.isPrivate }
            : item
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新照片失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("确定删除这张照片吗？")) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(id);
    setMessage("");

    try {
      const response = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": password,
        },
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "删除照片失败。"
        );
      }

      setPhotos((current) => current.filter((photo) => photo._id !== id));
      setMessage("照片已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除照片失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <div className="admin-kicker">Photos</div>
            <h1 className="section-title">管理相册</h1>
            <p className="section-copy">
              图片会从浏览器直接上传到 Blob。你也可以把单张照片设成仅后台可见。
            </p>
          </div>
        </div>

        {message ? <div className="status-banner">{message}</div> : null}

        <div className="photo-admin-layout">
          <section className="photo-upload-card">
            <div className="photo-upload-preview">
              {preview ? (
                <Image
                  src={preview}
                  alt="预览"
                  width={1200}
                  height={900}
                  sizes="(max-width: 960px) calc(100vw - 40px), 360px"
                  unoptimized
                  className="admin-preview"
                />
              ) : (
                <div className="photo-upload-empty">
                  <div className="photo-upload-icon">图</div>
                  <strong>拖一张图进来，或者点下面选择文件</strong>
                  <p>支持大图直传，不再走 Next.js 函数大请求体。</p>
                </div>
              )}
            </div>

            <div className="photo-upload-form">
              <input
                className="admin-input"
                placeholder="照片说明"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />

              <select
                className="admin-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value="__custom__">自定义分类</option>
              </select>

              {category === "__custom__" ? (
                <input
                  className="admin-input"
                  placeholder="输入新的分类，例如胶片"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                />
              ) : null}

              <input
                className="admin-input"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] || null)
                }
              />

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                />
                <span>仅后台可见</span>
              </label>

              {uploading ? (
                <div className="upload-progress">
                  <div className="upload-progress-bar">
                    <div
                      className="upload-progress-value"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span>上传中 {uploadProgress}%</span>
                </div>
              ) : null}

              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-button"
                  onClick={uploadPhoto}
                  disabled={uploading}
                >
                  {uploading ? "上传中..." : "上传到相册"}
                </button>
              </div>
            </div>
          </section>

          <section className="photo-library-card">
            <div className="dash-recent-header">
              <strong>相册内容</strong>
              <span className="dash-recent-meta">共 {photos.length} 张</span>
            </div>

            {photos.length > 0 ? (
              <div className="photo-admin-grid">
                {photos.map((photo) => {
                  const busy = busyPhotoId === photo._id;

                  return (
                    <article key={photo._id} className="photo-admin-item">
                      <Image
                        src={photo.url}
                        alt={photo.caption}
                        width={640}
                        height={480}
                        sizes="(max-width: 960px) 50vw, 240px"
                        unoptimized
                        className="photo-admin-media"
                      />

                      <div className="photo-admin-body">
                        <div className="photo-admin-meta">
                          <strong>{photo.caption}</strong>
                          <span>{photo.category || "未分类"}</span>
                        </div>

                        <div className="photo-admin-tags">
                          <span
                            className={`post-visit-chip ${photo.isPrivate ? "post-visit-chip-muted" : ""}`}
                          >
                            {photo.isPrivate ? "仅后台可见" : "前台可见"}
                          </span>
                        </div>

                        <div className="photo-admin-actions">
                          <button
                            type="button"
                            className="secondary-link photo-admin-action"
                            onClick={() => void togglePrivate(photo)}
                            disabled={busy || uploading}
                          >
                            {photo.isPrivate ? "设为公开" : "设为私密"}
                          </button>
                          <button
                            type="button"
                            className="danger-btn photo-admin-action"
                            onClick={() => void deletePhoto(photo._id)}
                            disabled={busy || uploading}
                          >
                            {busy ? "处理中..." : "删除"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="photo-library-empty">
                <div className="empty-icon">册</div>
                <p>相册里还没有照片，先上传第一张。</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
