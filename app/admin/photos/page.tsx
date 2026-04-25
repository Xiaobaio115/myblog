/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";

type PhotoItem = {
  _id: string;
  url?: string;
  caption: string;
  date: string;
};

export default function AdminPhotosPage() {
  const [password, setPassword] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile]
  );

  useEffect(() => {
    refreshPhotos();
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
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        setPhotos(data);
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

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "上传图片失败。");
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
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error || "保存照片失败。");
      }

      setSelectedFile(null);
      setCaption("");
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "删除失败。");
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
              上传后会先写入 Blob，再把元数据保存到 MongoDB 的 `photos` 集合。
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
              type="file"
              accept="image/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />

            {previewUrl ? (
              <img src={previewUrl} alt="预览" className="admin-preview" />
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon">🖼️</div>
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
                      <span>{photo.date}</span>
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
                <p>相册里还没有照片，上传一张就能在 `/photos` 页面看到。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
