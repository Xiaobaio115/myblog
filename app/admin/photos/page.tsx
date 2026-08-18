/* eslint-disable @next/next/no-img-element */
"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminPassword } from "@/lib/admin-api";
import styles from "./admin-photos.module.css";

type Photo = {
  _id: string;
  url: string;
  pathname?: string;
  caption: string;
  category: string;
  location?: string;
  date?: string;
  isPrivate?: boolean;
  showIn3d?: boolean;
};

const DEFAULT_CATEGORIES = ["日常", "旅行", "风景", "美食", "截图", "灵感"];
const ALL_FILTER = "全部";
const THREE_D_FILTER = "3D 展示";
const PRIVATE_FILTER = "私密";
const UNCATEGORIZED = "未分类";

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("日常");
  const [location, setLocation] = useState("");
  const [photoDate, setPhotoDate] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busyPhotoId, setBusyPhotoId] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, { caption: string; category: string; location: string; date: string }>>({});

  const categories = useMemo(() => {
    const fromPhotos = photos.map((photo) => photo.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromPhotos]));
  }, [photos]);

  const filterTabs = useMemo(() => {
    const cats = Array.from(new Set(photos.map((photo) => photo.category || UNCATEGORIZED)));
    return [ALL_FILTER, ...cats, THREE_D_FILTER, PRIVATE_FILTER];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (activeFilter === ALL_FILTER) return photos;
    if (activeFilter === THREE_D_FILTER) return photos.filter((photo) => photo.showIn3d);
    if (activeFilter === PRIVATE_FILTER) return photos.filter((photo) => photo.isPrivate);
    return photos.filter((photo) => (photo.category || UNCATEGORIZED) === activeFilter);
  }, [photos, activeFilter]);

  const groupedByCategory = useMemo(() => {
    if (activeFilter !== ALL_FILTER) return null;
    const map = new Map<string, Photo[]>();
    for (const photo of photos) {
      const cat = photo.category || UNCATEGORIZED;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(photo);
    }
    return map;
  }, [photos, activeFilter]);

  const publicCount = photos.filter((photo) => !photo.isPrivate).length;
  const privateCount = photos.filter((photo) => photo.isPrivate).length;
  const selectedCount = photos.filter((photo) => photo.showIn3d).length;

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const nextPhotos = await adminFetch<Photo[]>("/api/photos", {
        fallbackError: "读取照片失败。",
      });
      setPhotos(Array.isArray(nextPhotos) ? nextPhotos : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取照片失败。");
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadPhotos());
  }, [loadPhotos]);

  function handleFileChange(nextFiles: File[]) {
    const invalidFile = nextFiles.find((file) => !file.type.startsWith("image/"));
    const oversizedFile = nextFiles.find((file) => file.size > 20 * 1024 * 1024);

    if (invalidFile) {
      setMessage(`“${invalidFile.name}”不是受支持的图片文件。`);
      return;
    }
    if (oversizedFile) {
      setMessage(`“${oversizedFile.name}”超过 20 MB，请压缩后上传。`);
      return;
    }

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

    const password = getAdminPassword();

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

        await adminFetch("/api/photos", {
          method: "POST",
          password,
          json: {
            url: uploaded.url,
            pathname: uploaded.pathname,
            caption:
              caption.trim() ||
              (files.length > 1
                ? currentFile.name.replace(/\.[^/.]+$/, "")
                : "我的照片"),
            category: finalCategory,
            location: location.trim(),
            date: photoDate.trim(),
            isPrivate,
          },
          fallbackError: "保存照片信息失败。",
        });
      }

      setCaption("");
      setCategory("日常");
      setLocation("");
      setPhotoDate("");
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

    const password = getAdminPassword();

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");

    try {
      await adminFetch(`/api/photos/${photo._id}`, {
        method: "DELETE",
        password,
        fallbackError: "删除照片失败。",
      });

      setPhotos((current) => current.filter((item) => item._id !== photo._id));
      setMessage("照片已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除照片失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  async function togglePrivate(photo: Photo) {
    const password = getAdminPassword();

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");

    try {
      await adminFetch(`/api/photos/${photo._id}`, {
        method: "PATCH",
        password,
        json: {
          isPrivate: !photo.isPrivate,
        },
        fallbackError: "更新可见性失败。",
      });

      setPhotos((current) =>
        current.map((item) =>
          item._id === photo._id
            ? { ...item, isPrivate: !photo.isPrivate }
            : item
        )
      );
      setMessage(photo.isPrivate ? "照片已设为公开。" : "照片已设为私密。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新可见性失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  async function toggle3d(photo: Photo) {
    const password = getAdminPassword();

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");

    try {
      await adminFetch(`/api/photos/${photo._id}`, {
        method: "PATCH",
        password,
        json: {
          showIn3d: !photo.showIn3d,
        },
        fallbackError: "更新 3D 展示状态失败。",
      });

      setPhotos((current) =>
        current.map((item) =>
          item._id === photo._id
            ? { ...item, showIn3d: !photo.showIn3d }
            : item
        )
      );
      setMessage(photo.showIn3d ? "照片已移出 3D 相册。" : "照片已加入 3D 相册。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新 3D 展示状态失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  async function updatePhotoMetadata(photo: Photo) {
    const draft = photoDrafts[photo._id] || {
      caption: photo.caption || "",
      category: photo.category || "",
      location: photo.location || "",
      date: photo.date || "",
    };
    const nextCaption = draft.caption.trim();
    const nextCategory = draft.category.trim();
    const nextLocation = draft.location.trim();
    const nextDate = draft.date.trim();

    if (!nextCategory) {
      setMessage("照片分类不能为空。");
      return;
    }

    setBusyPhotoId(photo._id);
    setMessage("");
    try {
      await adminFetch(`/api/photos/${photo._id}`, {
        method: "PATCH",
        json: { caption: nextCaption, category: nextCategory, location: nextLocation, date: nextDate },
        fallbackError: "更新照片信息失败。",
      });
      setPhotos((current) => current.map((item) => (
        item._id === photo._id
          ? { ...item, caption: nextCaption, category: nextCategory, location: nextLocation, date: nextDate }
          : item
      )));
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[photo._id];
        return next;
      });
      setMessage("照片说明、分类、地点和日期已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新照片信息失败。");
    } finally {
      setBusyPhotoId("");
    }
  }

  function getFilterCount(tab: string) {
    if (tab === ALL_FILTER) return photos.length;
    if (tab === THREE_D_FILTER) return selectedCount;
    if (tab === PRIVATE_FILTER) return privateCount;
    return photos.filter((photo) => (photo.category || UNCATEGORIZED) === tab).length;
  }

  function renderPhotoCard(photo: Photo) {
    const busy = busyPhotoId === photo._id;
    return (
      <article key={photo._id} className="photo-admin-item">
        <img src={photo.url} alt={photo.caption || "照片"} className="photo-admin-media" />
        <div className="photo-admin-body">
          <div className="photo-admin-meta">
            <strong>{photo.caption || "未命名图片"}</strong>
            <span>{photo.category || UNCATEGORIZED}{photo.location ? ` · ${photo.location}` : ""}</span>
          </div>
          <div className="photo-admin-tags">
            <span className={`post-visit-chip ${photo.isPrivate ? "post-visit-chip-muted" : ""}`}>
              {photo.isPrivate ? "仅后台可见" : "前台可见"}
            </span>
            {photo.showIn3d ? <span className="post-visit-chip">3D 展示中</span> : null}
          </div>
          <details className={styles.metadataEditor}>
            <summary>编辑说明、分类与地点</summary>
            <div className={styles.metadataFields}>
              <label>
                <span>照片说明</span>
                <input
                  className="admin-input"
                  value={photoDrafts[photo._id]?.caption ?? photo.caption ?? ""}
                  onChange={(event) => setPhotoDrafts((current) => ({
                    ...current,
                    [photo._id]: {
                      caption: event.target.value,
                      category: current[photo._id]?.category ?? photo.category ?? "",
                      location: current[photo._id]?.location ?? photo.location ?? "",
                      date: current[photo._id]?.date ?? photo.date ?? "",
                    },
                  }))}
                  disabled={busy || uploading}
                />
              </label>
              <label>
                <span>分类</span>
                <input
                  className="admin-input"
                  list="photo-category-options"
                  value={photoDrafts[photo._id]?.category ?? photo.category ?? ""}
                  onChange={(event) => setPhotoDrafts((current) => ({
                    ...current,
                    [photo._id]: {
                      caption: current[photo._id]?.caption ?? photo.caption ?? "",
                      category: event.target.value,
                      location: current[photo._id]?.location ?? photo.location ?? "",
                      date: current[photo._id]?.date ?? photo.date ?? "",
                    },
                  }))}
                  disabled={busy || uploading}
                />
              </label>
              <label>
                <span>地点</span>
                <input
                  className="admin-input"
                  placeholder="例如：海口 / 三亚 / 家"
                  value={photoDrafts[photo._id]?.location ?? photo.location ?? ""}
                  onChange={(event) => setPhotoDrafts((current) => ({
                    ...current,
                    [photo._id]: {
                      caption: current[photo._id]?.caption ?? photo.caption ?? "",
                      category: current[photo._id]?.category ?? photo.category ?? "",
                      location: event.target.value,
                      date: current[photo._id]?.date ?? photo.date ?? "",
                    },
                  }))}
                  disabled={busy || uploading}
                />
              </label>
              <label>
                <span>拍摄日期</span>
                <input
                  className="admin-input"
                  placeholder="例如：2026-08-18"
                  value={photoDrafts[photo._id]?.date ?? photo.date ?? ""}
                  onChange={(event) => setPhotoDrafts((current) => ({
                    ...current,
                    [photo._id]: {
                      caption: current[photo._id]?.caption ?? photo.caption ?? "",
                      category: current[photo._id]?.category ?? photo.category ?? "",
                      location: current[photo._id]?.location ?? photo.location ?? "",
                      date: event.target.value,
                    },
                  }))}
                  disabled={busy || uploading}
                />
              </label>
              <button
                type="button"
                className="secondary-link"
                onClick={() => void updatePhotoMetadata(photo)}
                disabled={busy || uploading || !photoDrafts[photo._id]}
              >
                {busy ? "保存中..." : "保存信息"}
              </button>
            </div>
          </details>
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
    <main className="admin-dashboard photo-admin-page">
      <div className="admin-page-head admin-page-head-compact">
        <div>
          <div className="admin-badge">PHOTOS</div>
          <h1>相册管理</h1>
          <p>上传照片、设置分类、控制公开状态，并挑选进入 3D 相册的内容。</p>
        </div>
        <button type="button" className="secondary-link" onClick={() => void loadPhotos()} disabled={loadingPhotos}>
          {loadingPhotos ? "读取中..." : "刷新图片库"}
        </button>
      </div>

      <section className="photo-admin-summary">
        <div>
          <span>全部照片</span>
          <strong>{photos.length}</strong>
        </div>
        <div>
          <span>前台可见</span>
          <strong>{publicCount}</strong>
        </div>
        <div>
          <span>私密照片</span>
          <strong>{privateCount}</strong>
        </div>
        <div>
          <span>3D 展示</span>
          <strong>{selectedCount}</strong>
        </div>
      </section>

      {message ? <div className="status-banner" role="status" aria-live="polite">{message}</div> : null}

      <datalist id="photo-category-options">
        {categories.map((item) => <option key={item} value={item} />)}
      </datalist>

      <section className="photo-admin-layout">
        <div className="photo-upload-card">
          <div>
            <div className="admin-badge">UPLOAD</div>
            <h2 className="section-title">上传图片</h2>
            <p className="section-copy">支持批量选择。上传后会保存到相册库，再按分类展示。</p>
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
                <strong>选择一张或多张图片</strong>
                <p>支持 JPG、PNG、WebP、GIF。上传前可先设置说明、分类和可见范围。</p>
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

            <input
              className="admin-input"
              placeholder="地点，可选，例如：海口"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              disabled={uploading}
            />

            <input
              className="admin-input"
              type="date"
              aria-label="拍摄日期"
              value={photoDate}
              onChange={(event) => setPhotoDate(event.target.value)}
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
          <div className="section-head photo-library-head">
            <div>
              <div className="admin-badge">LIBRARY</div>
              <h2 className="section-title">图片库</h2>
              <p className="section-copy">当前筛选：{activeFilter}，共 {filteredPhotos.length} 张。</p>
            </div>
          </div>

          {loadingPhotos && photos.length === 0 ? (
            <div className="photo-library-empty" role="status">正在读取图片库...</div>
          ) : photos.length > 0 ? (
            <>
              <div className="photo-library-filters">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`photo-library-filter-btn${activeFilter === tab ? " photo-library-filter-active" : ""}`}
                    onClick={() => setActiveFilter(tab)}
                  >
                    {tab}
                    <span className="photo-filter-count">{getFilterCount(tab)}</span>
                  </button>
                ))}
              </div>

              {activeFilter === ALL_FILTER && groupedByCategory ? (
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
                  <p>这个筛选条件下还没有图片。</p>
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
    </main>
  );
}
