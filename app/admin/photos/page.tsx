"use client";

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

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("日常");
  const [customCategory, setCustomCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const categories = useMemo(() => {
    const fromPhotos = photos.map((photo) => photo.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromPhotos]));
  }, [photos]);

  async function loadPhotos() {
    const res = await fetch("/api/photos", {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setPhotos(data);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  function handleFileChange(selectedFile: File | null) {
    setFile(selectedFile);

    if (!selectedFile) {
      setPreview("");
      return;
    }

    setPreview(URL.createObjectURL(selectedFile));
  }

  async function uploadPhoto() {
    if (!file) {
      alert("请先选择图片");
      return;
    }

    const finalCategory =
      category === "自定义" ? customCategory.trim() : category;

    if (!finalCategory) {
      alert("请输入分类");
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", caption || "我的照片");
    formData.append("category", finalCategory);

    setUploading(true);

    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "x-admin-password": password,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "上传失败");
        return;
      }

      setCaption("");
      setCategory(finalCategory);
      setCustomCategory("");
      setFile(null);
      setPreview("");

      await loadPhotos();

      alert("上传成功！");
    } catch (error) {
      console.error(error);
      alert("上传失败，请查看 Vercel 日志");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("确定删除这张照片吗？")) return;

    const password = localStorage.getItem("admin_password") || "";

    const res = await fetch(`/api/photos/${id}`, {
      method: "DELETE",
      headers: {
        "x-admin-password": password,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }

    setPhotos((items) => items.filter((item) => item._id !== id));
  }

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">PHOTO MANAGER</div>
          <h1>相册管理</h1>
          <p>上传图片到 Vercel Blob，并按分类保存到 MongoDB。</p>
        </div>
      </div>

      <section className="photo-admin-layout">
        <div className="photo-upload-panel">
          <h2>上传新照片</h2>

          <input
            className="admin-input"
            placeholder="照片说明"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          <select
            className="admin-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="自定义">自定义分类</option>
          </select>

          {category === "自定义" && (
            <input
              className="admin-input"
              placeholder="输入新的分类，例如 胶片"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          )}

          <label className="photo-file-drop">
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleFileChange(e.target.files?.[0] || null)
              }
            />

            {preview ? (
              <img src={preview} alt="预览" />
            ) : (
              <div>
                <span>📤</span>
                <p>点击选择图片</p>
                <small>支持 JPG、PNG、WebP、GIF</small>
              </div>
            )}
          </label>

          <button
            className="admin-button"
            onClick={uploadPhoto}
            disabled={uploading}
          >
            {uploading ? "上传中..." : "上传到相册"}
          </button>
        </div>

        <div className="photo-manage-panel">
          <h2>已上传照片</h2>

          {photos.length === 0 ? (
            <div className="empty-mini">还没有照片</div>
          ) : (
            <div className="photo-manage-list">
              {photos.map((photo) => (
                <div key={photo._id} className="photo-manage-item">
                  <img src={photo.url} alt={photo.caption} />

                  <div>
                    <strong>{photo.caption}</strong>
                    <p>{photo.category}</p>
                  </div>

                  <button onClick={() => deletePhoto(photo._id)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}