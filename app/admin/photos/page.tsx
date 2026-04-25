/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";

type PhotoItem = {
  _id: string;
  url?: string;
  caption: string;
  date: string;
  category?: string;
};

type ApiPayload = {
  error?: string;
  url?: string;
};

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text } satisfies ApiPayload;
  }
}

export default function AdminPhotosPage() {
  const [password, setPassword] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile]
  );

  useEffect(() => {
    void refreshPhotos();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function refreshPhotos() {
    try {
      const response = await fetch("/api/photos", { cache: "no-store" });
      const data = await parseJsonSafely(response);

      if (response.ok && Array.isArray(data)) {
        setPhotos(data as PhotoItem[]);
      }
    } catch (error) {
      console.error("refresh photos failed:", error);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setMessage("请先选择一张图片。");
      return;
    }

    if (!password.trim()) {
      setMessage("请先输入后台密码。");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-admin-password": password,
        },
        body: formData,
      });

      const uploadData = (await parseJsonSafely(uploadResponse)) as ApiPayload | null;

      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error || "上传图片失败。");
      }

      if (!uploadData?.url) {
        throw new Error("上传接口没有返回图片地址。");
      }

      const saveResponse = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          url: uploadData.url,
          caption: caption.trim(),
          category: category.trim() || "日常",
        }),
      });

      const saveData = (await parseJsonSafely(saveResponse)) as ApiPayload | null;

      if (!saveResponse.ok) {
        throw new Error(saveData?.error || "保存照片失败。");
      }

      setSelectedFile(null);
      setCaption("");
      setCategory("");
      setMessage("照片已加入相册。");
      await refreshPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!password.trim()) {
      setMessage("删除照片前请先输入后台密码。");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": password,
        },
      });

      const data = (await parseJsonSafely(response)) as ApiPayload | null;

      if (!response.ok) {
        throw new Error(data?.error || "删除失败。");
      }

      setMessage("照片已删除。");
      await refreshPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <h1 className="section-title">管理相册</h1>
            <p className="section-copy">
              上传后会先写入 Blob，再把元数据保存到 MongoDB 的
              <code> photos </code>
              集合。
            </p>
          </div>
        </div>

        <div className="admin-grid">
          <div className="upload-panel">
            <input
              className="admin-input"
              type="password"
              placeholder="后台密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <input
              className="admin-input"
              type="text"
              placeholder="照片说明"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />

            <input
              className="admin-input"
              type="text"
              placeholder="分类（如：日常、旅行、风景）"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />

            <input
              className="admin-input"
              type="file"
              accept="image/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />

            {previewUrl ? (
              <img src={previewUrl} alt="预览" className="admin-preview" />
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon">📤</div>
                <p>选择图片后会在这里预览。</p>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={handleUpload}
                disabled={loading}
              >
                {loading ? "处理中..." : "上传到相册"}
              </button>
            </div>
          </div>

          <div>
            {message ? <div className="status-banner">{message}</div> : null}

            {photos.length > 0 ? (
              <div className="upload-grid">
                {photos.map((photo) => (
                  <article key={photo._id} className="upload-photo">
                    {photo.url ? (
                      <img src={photo.url} alt={photo.caption} className="photo-media" />
                    ) : null}
                    <div className="upload-photo-body">
                      <strong>{photo.caption}</strong>
                      <span>{photo.category ? `${photo.category} · ` : ""}{photo.date}</span>
                    </div>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => handleDelete(photo._id)}
                      disabled={loading}
                    >
                      删除
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon">📷</div>
                <p>相册里还没有照片，上传一张后就会出现在 `/photos` 页面。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
