"use client";

import { useState, useEffect } from "react";

type PostItem = { _id: string; title: string; date?: string; published?: boolean };
type PhotoItem = { _id: string; caption: string; date?: string; category?: string };

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_password");
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void fetchData();
  }, [authed]);

  async function fetchData() {
    setLoading(true);
    try {
      const [postsRes, photosRes] = await Promise.all([
        fetch("/api/posts", { cache: "no-store" }),
        fetch("/api/photos", { cache: "no-store" }),
      ]);
      if (postsRes.ok) setPosts(await postsRes.json());
      if (photosRes.ok) setPhotos(await photosRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin() {
    if (!password.trim()) return;
    localStorage.setItem("admin_password", password);
    setAuthed(true);
  }

  function handleLogout() {
    localStorage.removeItem("admin_password");
    setAuthed(false);
    setPassword("");
    setPosts([]);
    setPhotos([]);
  }

  if (!authed) {
    return (
      <main className="admin-page">
        <div className="admin-panel narrow">
          <div className="section-head">
            <div>
              <h1 className="section-title">博客后台</h1>
              <p className="section-copy">请输入密码进入管理后台。</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="输入后台密码"
            className="admin-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button className="admin-button" onClick={handleLogin}>
            进入后台
          </button>
        </div>
      </main>
    );
  }

  const publishedCount = posts.filter((p) => p.published !== false).length;
  const recentPosts = posts.slice(0, 4);
  const recentPhotos = photos.slice(0, 4);

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="dash-header">
          <div>
            <h1 className="section-title">后台总览</h1>
            <p className="section-copy">欢迎回来，这里是你的博客管理中心。</p>
          </div>
          <button className="secondary-link" style={{ fontSize: "0.85rem" }} onClick={handleLogout}>
            退出登录
          </button>
        </div>

        <div className="dash-stats">
          <div className="dash-stat">
            <strong>{loading ? "—" : posts.length}</strong>
            <span>全部文章</span>
          </div>
          <div className="dash-stat dash-stat-accent">
            <strong>{loading ? "—" : publishedCount}</strong>
            <span>已发布</span>
          </div>
          <div className="dash-stat">
            <strong>{loading ? "—" : photos.length}</strong>
            <span>相册照片</span>
          </div>
        </div>

        <p className="dash-section-label">快捷操作</p>
        <div className="admin-card-grid">
          <a href="/admin/posts" className="admin-card-link action-card">
            <span className="action-icon">✏️</span>
            <strong>发布新文章</strong>
            <span>写文章、填标签和封面图。</span>
          </a>
          <a href="/admin/photos" className="admin-card-link action-card">
            <span className="action-icon">📷</span>
            <strong>上传照片</strong>
            <span>上传图片并按分类管理相册。</span>
          </a>
          <a href="/articles" className="admin-card-link action-card">
            <span className="action-icon">📰</span>
            <strong>查看文章列表</strong>
            <span>浏览所有已发布文章。</span>
          </a>
          <a href="/" className="admin-card-link action-card">
            <span className="action-icon">🏠</span>
            <strong>返回首页</strong>
            <span>查看博客首页展示效果。</span>
          </a>
        </div>

        <p className="dash-section-label">最近内容</p>
        <div className="admin-card-grid">
          <div className="dash-recent-box">
            <div className="dash-recent-header">
              <strong>最近文章</strong>
              <a href="/admin/posts" className="dash-more-link">管理 →</a>
            </div>
            {loading ? (
              <p className="section-copy">加载中…</p>
            ) : recentPosts.length > 0 ? (
              <div className="dash-recent-list">
                {recentPosts.map((post) => (
                  <div key={post._id} className="dash-recent-item">
                    <span className="dash-recent-dot" />
                    <div>
                      <p className="dash-recent-title">{post.title}</p>
                      <p className="dash-recent-meta">{post.date || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-copy">还没有文章。</p>
            )}
          </div>

          <div className="dash-recent-box">
            <div className="dash-recent-header">
              <strong>最近照片</strong>
              <a href="/admin/photos" className="dash-more-link">管理 →</a>
            </div>
            {loading ? (
              <p className="section-copy">加载中…</p>
            ) : recentPhotos.length > 0 ? (
              <div className="dash-recent-list">
                {recentPhotos.map((photo) => (
                  <div key={photo._id} className="dash-recent-item">
                    <span className="dash-recent-dot" />
                    <div>
                      <p className="dash-recent-title">{photo.caption}</p>
                      <p className="dash-recent-meta">{photo.category || photo.date || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-copy">还没有照片。</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
