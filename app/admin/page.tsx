"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return (
      <main className="admin-page">
        <div className="admin-panel narrow">
          <div className="section-head">
            <div>
              <h1 className="section-title">博客后台</h1>
              <p className="section-copy">这里只做一个轻量入口，用来进入文章和相册管理页。</p>
            </div>
          </div>

          <input
            type="password"
            placeholder="输入后台密码"
            className="admin-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button
            className="admin-button"
            onClick={() => {
              localStorage.setItem("admin_password", password);
              setAuthed(true);
            }}
          >
            进入后台
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="section-head">
          <div>
            <h1 className="section-title">后台总览</h1>
            <p className="section-copy">文章管理和相册管理已经拆开，不再停留在单页结构。</p>
          </div>
        </div>

        <div className="admin-card-grid">
          <a href="/admin/posts" className="admin-card-link">
            <strong>文章管理</strong>
            <span>发布新文章、维护摘要和封面图。</span>
          </a>

          <a href="/admin/photos" className="admin-card-link">
            <strong>相册管理</strong>
            <span>上传图片并同步到 `/photos` 页面展示。</span>
          </a>
        </div>
      </div>
    </main>
  );
}
