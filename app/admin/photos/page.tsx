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
  createdAt?: string;
};

const DEFAULT_CATEGORIES = ["日常", "旅行", "风景", "美食", "截图", "灵感"];

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");

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
        setPhotos(data as Photo[]);
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

      const saveResponse = await fetch("/api/photos", {
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
        }),
      });

      const data = (await parseJsonSafely(saveResponse)) as
        | { error?: string; photo?: Photo }
        | null;

      if (!saveResponse.ok) {
        throw new Error(data?.error || "保存相册信息失败。");
      }

      setCaption("");
      setCategory(finalCategory);
      setCustomCategory("");
      setFile(null);
      setPreview("");
      setUploadProgress(0);
      setMessage("图片已上传到相册。");

      if (data?.photo) {
        setPhotos((current) => [data.photo as Photo, ...current]);
      } else {
        await loadPhotos();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("确定删除这张照片吗？")) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    try {
      const response = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": password,
        },
      });

      const data = (await parseJsonSafely(response)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "删除失败。");
      }

      setPhotos((current) => current.filter((photo) => photo._id !== id));
      setMessage("照片已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
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
              图片现在会从浏览器直接上传到 Vercel Blob，大图不会再经过 Next.js 函数。
            </p>
          </div>
        </div>

        {message ? <div className="status-banner">{message}</div> : null}

        <div className="admin-grid">
          <div className="upload-panel">
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
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
            />

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

            {preview ? (
              <Image
                src={preview}
                alt="预览"
                width={1200}
                height={900}
                sizes="(max-width: 720px) calc(100vw - 24px), 50vw"
                unoptimized
                className="admin-preview"
              />
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon">图</div>
                <p>选择图片后会在这里显示预览。</p>
              </div>
            )}

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

          <div>
            {photos.length > 0 ? (
              <div className="upload-grid">
                {photos.map((photo) => (
                  <article key={photo._id} className="upload-photo">
                    <Image
                      src={photo.url}
                      alt={photo.caption}
                      width={110}
                      height={88}
                      sizes="110px"
                      unoptimized
                      className="photo-media"
                    />
                    <div className="upload-photo-body">
                      <strong>{photo.caption}</strong>
                      <span>{photo.category || "未分类"}</span>
                    </div>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => deletePhoto(photo._id)}
                      disabled={uploading}
                    >
                      删除
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon">册</div>
                <p>相册里还没有照片，先上传第一张。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
