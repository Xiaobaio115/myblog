/* eslint-disable @next/next/no-img-element */
"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useEffect, useMemo, useState } from "react";

type Photo = {
  _id: string;
  url: string;
  pathname?: string;
  caption: string;
  category: string;
  isPrivate?: boolean;
  showIn3d?: boolean;
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

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("日常");
  const [customCategory, setCustomCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busyPhotoId, setBusyPhotoId] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("全部");

  const categories = useMemo(() => {
    const fromPhotos = photos.map((photo) => photo.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromPhotos]));
  }, [photos]);

  const filterTabs = useMemo(() => {
    const cats = Array.from(new Set(photos.map((p) => p.category || "未分类")));
    return ["全部", ...cats, "3D展示", "私密"];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (activeFilter === "全部") return photos;
    if (activeFilter === "3D展示") return photos.filter((p) => p.showIn3d);
    if (activeFilter === "私密") return photos.filter((p) => p.isPrivate);
    return photos.filter((p) => (p.category || "未分类") === activeFilter);
  }, [photos, activeFilter]);

  const groupedByCategory = useMemo(() => {
    if (activeFilter !== "全部") return null;
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const cat = p.category || "未分类";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [photos, activeFilter]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  async function loadPhotos() {
    const response = await fetch("/api/photos", { cache: "no-store" });

    if (!response.ok) {
      const data = await parseJsonSafely(response);
      throw new Error(
        typeof data?.error === "string" ? data.error : "读取照片失败。"
      );
    }

    setPhotos((await response.json()) as Photo[]);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/photos", { cache: "no-store" });

        if (!response.ok) {
          const data = await parseJsonSafely(response);
          throw new Error(
            typeof data?.error === "string" ? data.error : "读取照片失败。"
          );
        }

        const nextPhotos = (await response.json()) as Photo[];

        if (!cancelled) {
          startTransition(() => {
            setPhotos(nextPhotos);
          });
        }
      } catch (error) {
        if (!cancelled) {
          startTransition(() => {
            setMessage(
              error instanceof Error ? error.message : "读取照片失败。"
            );
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(nextFiles: File[]) {
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles(nextFiles);
    setPreviews(nextFiles.map((nextFile) => URL.createObjectURL(nextFile)));
  }

  async function uploadPhoto() {
    if (files.length === 0) {
      setMessage("请先选择图片。");
      return;
    }

    const finalCategory =
      category === "__custom__" ? customCategory.trim() : category;

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
    setProgress(0);
    setMessage("");

    try {
      for (const [index, currentFile] of files.entries()) {
        const uploaded = await upload(currentFile.name, currentFile, {
          access: "public",
          contentType: currentFile.type,
          handleUploadUrl: "/api/photos/upload",
          headers: {
            "x-admin-password": password,
          },
          multipart: currentFile.size > 5 * 1024 * 1024,
          onUploadProgress(event) {
            setProgress(
              Math.round(((index + event.percentage / 100) / files.length) * 100)
            );
          },
        });

        const metaResponse = await fetch("/api/photos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
          body: JSON.stringify({
            url: uploaded.url,
            pathname: uploaded.pathname,
            caption:
              caption.trim() ||
              (files.length > 1
                ? currentFile.name.replace(/\.[^/.]+$/, "")
                : "我的照片"),
            category: finalCategory,
            isPrivate,
          }),
        });
        const metaData = await parseJsonSafely(metaResponse);

        if (!metaResponse.ok) {
          throw new Error(
            typeof metaData?.error === "string"
              ? metaData.error
              : "保存照片信息失败。"
          );
        }
      }

      setCaption("");
      setCategory("日常");
      setCustomCategory("");
      setIsPrivate(false);
      handleFileChange([]);
      setProgress(0);
      setMessage(files.length > 1 ? `${files.length} 张照片已上传。` : "照片已上传。");
      await loadPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传照片失败。");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    const confirmed = window.confirm("确定删除这张照片吗？");

    if (!confirmed) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");

    try {
      const response = await fetch(`/api/photos/${photo._id}`, {
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

      setPhotos((current) => current.filter((item) => item._id !== photo._id));
      setMessage("照片已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除照片失败。");
    } finally {
      setBusyPhotoId("");
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
          typeof data?.error === "string" ? data.error : "更新可见性失败。"
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
      setMessage(error instanceof Error ? error.message : "更新可见性失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  async function toggle3d(photo: Photo) {
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
          showIn3d: !photo.showIn3d,
        }),
      });
      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "更新 3D 状态失败。"
        );
      }

      setPhotos((current) =>
        current.map((item) =>
          item._id === photo._id
            ? { ...item, showIn3d: !photo.showIn3d }
            : item
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新 3D 状态失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  const selectedCount = photos.filter((photo) => photo.showIn3d).length;

  function renderPhotoCard(photo: Photo) {
    const busy = busyPhotoId === photo._id;
    return (
      <article key={photo._id} className="photo-admin-item">
        <img src={photo.url} alt={photo.caption} className="photo-admin-media" />
        <div className="photo-admin-body">
          <div className="photo-admin-meta">
            <strong>{photo.caption || "未命名图片"}</strong>
            <span>{photo.category || "未分类"}</span>
          </div>
          <div className="photo-admin-tags">
            <span className={`post-visit-chip ${photo.isPrivate ? "post-visit-chip-muted" : ""}`}>
              {photo.isPrivate ? "仅后台可见" : "前台可见"}
            </span>
            {photo.showIn3d ? <span className="post-visit-chip">3D 展示中</span> : null}
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
              className="secondary-link photo-admin-action"
              onClick={() => void toggle3d(photo)}
              disabled={busy || uploading}
            >
              {photo.showIn3d ? "移出 3D" : "加入 3D"}
            </button>
            <button
              type="button"
              className="danger-btn photo-admin-action"
              onClick={() => void deletePhoto(photo)}
              disabled={busy || uploading}
            >
              {busy ? "处理中..." : "删除"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <div className="admin-kicker">Photos</div>
            <h1 className="section-title">相册管理</h1>
            <p className="section-copy">
              上传照片、切换公开或私密、删除照片，以及挑选进入 3D 展示的内容。
            </p>
          </div>
        </div>

        {message ? <div className="status-banner">{message}</div> : null}

        <section className="photo-admin-layout">
          <div className="photo-upload-card">
            <div>
              <h2 className="section-title">上传图片</h2>
              <p className="section-copy">
                支持公开或仅后台可见。大图会直接上传到 Blob，不再走旧的函数体上传。
              </p>
            </div>

            <label className="photo-file-drop">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  handleFileChange(Array.from(event.target.files || []))
                }
              />
              {previews.length > 0 ? (
                <div className="photo-upload-preview-grid">
                  {previews.slice(0, 6).map((preview, index) => (
                    <img
                      key={preview}
                      src={preview}
                      alt={`预览 ${index + 1}`}
                      className="photo-upload-preview"
                    />
                  ))}
                  {previews.length > 6 ? (
                    <span className="photo-upload-count">+{previews.length - 6}</span>
                  ) : null}
                </div>
              ) : (
                <div className="photo-upload-empty">
                  <div className="photo-upload-icon">IMG</div>
                  <strong>选择一张或多张要上传的图片</strong>
                  <p>支持 JPG、PNG、WebP、GIF。上传后会自动保存到相册库。</p>
                </div>
              )}
            </label>

            <div className="photo-upload-form">
              <input
                className="admin-input"
                placeholder="图片说明，可选"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={uploading}
              />

              <select
                className="admin-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={uploading}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value="__custom__">+ 自定义分类</option>
              </select>

              {category === "__custom__" ? (
                <input
                  className="admin-input"
                  placeholder="输入新的分类名"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  disabled={uploading}
                />
              ) : null}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                  disabled={uploading}
                />
                <span>仅后台可见</span>
              </label>

              {uploading ? (
                <div className="upload-progress">
                  <span>上传中 {progress}%</span>
                  <div className="upload-progress-bar">
                    <div
                      className="upload-progress-value"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="admin-button"
                onClick={() => void uploadPhoto()}
                disabled={uploading}
              >
                {uploading
                  ? "上传中..."
                  : files.length > 1
                    ? `上传 ${files.length} 张图片`
                    : "上传到相册"}
              </button>
            </div>
          </div>

          <div className="photo-library-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">图片库</h2>
                <p className="section-copy">
                  共 {photos.length} 张，已加入 3D 展示 {selectedCount} 张。
                </p>
              </div>
            </div>

            {photos.length > 0 ? (
              <>
                <div className="photo-library-filters">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`photo-library-filter-btn${activeFilter === tab ? " photo-library-filter-active" : ""}`}
                      onClick={() => setActiveFilter(tab)}
                    >
                      {tab === "3D展示" ? "✨ 3D 展示" : tab === "私密" ? "🔒 私密" : tab}
                      <span className="photo-filter-count">
                        {tab === "全部"
                          ? photos.length
                          : tab === "3D展示"
                            ? photos.filter((p) => p.showIn3d).length
                            : tab === "私密"
                              ? photos.filter((p) => p.isPrivate).length
                              : photos.filter((p) => (p.category || "未分类") === tab).length}
                      </span>
                    </button>
                  ))}
                </div>

                {activeFilter === "全部" && groupedByCategory ? (
                  <div className="photo-category-sections">
                    {Array.from(groupedByCategory.entries()).map(([cat, catPhotos]) => (
                      <div key={cat} className="photo-category-group">
                        <div className="photo-category-heading">
                          <span>{cat}</span>
                          <span className="photo-category-count">{catPhotos.length} 张</span>
                        </div>
                        <div className="photo-admin-grid">
                          {catPhotos.map((photo) => renderPhotoCard(photo))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredPhotos.length > 0 ? (
                  <div className="photo-admin-grid">
                    {filteredPhotos.map((photo) => renderPhotoCard(photo))}
                  </div>
                ) : (
                  <div className="photo-library-empty">
                    <div className="empty-icon">空</div>
                    <p>这个分类下还没有图片。</p>
                  </div>
                )}
              </>
            ) : (
              <div className="photo-library-empty">
                <div className="empty-icon">图</div>
                <p>还没有图片，先上传一张看看。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
