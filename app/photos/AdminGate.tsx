"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedPassword = localStorage.getItem("admin_password");
    if (savedPassword) {
      setAuthed(true);
    }
    setReady(true);
  }, []);

  function login() {
    if (!password.trim()) {
      alert("请输入后台密码");
      return;
    }

    localStorage.setItem("admin_password", password);
    setAuthed(true);
  }

  function logout() {
    localStorage.removeItem("admin_password");
    setAuthed(false);
    setPassword("");
  }

  if (!ready) {
    return null;
  }

  if (!authed) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <div className="admin-badge">LUNA NOTES ADMIN</div>
          <h1>博客后台</h1>
          <p>输入一次后台密码后，就可以进入文章和相册管理。</p>

          <input
            type="password"
            className="admin-input"
            placeholder="输入后台密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />

          <button className="admin-button" onClick={login}>
            进入后台
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          LUNA NOTES
        </Link>

        <nav className="admin-menu">
          <Link href="/admin">总览</Link>
          <Link href="/admin/posts">文章管理</Link>
          <Link href="/admin/photos">相册管理</Link>
          <Link href="/photos">查看相册</Link>
          <Link href="/">返回首页</Link>
        </nav>

        <button className="admin-logout" onClick={logout}>
          退出后台
        </button>
      </aside>

      <section className="admin-main">{children}</section>
    </div>
  );
}