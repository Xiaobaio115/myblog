"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

export default function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem("admin_password");

    if (!saved) {
      startTransition(() => {
        setReady(true);
      });

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth", {
          headers: { "x-admin-password": saved },
        });

        if (cancelled) {
          return;
        }

        startTransition(() => {
          if (response.ok) {
            setAuthed(true);
          } else {
            localStorage.removeItem("admin_password");
          }

          setReady(true);
        });
      } catch {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          localStorage.removeItem("admin_password");
          setReady(true);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login() {
    if (!password.trim()) {
      alert("请输入后台密码");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth", {
        headers: { "x-admin-password": password },
      });

      if (!response.ok) {
        alert("密码错误，请重试");
        return;
      }

      localStorage.setItem("admin_password", password);
      setAuthed(true);
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
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
          <p>输入后台密码后，就可以进入文章和相册管理。</p>

          <input
            type="password"
            className="admin-input"
            placeholder="输入后台密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void login();
              }
            }}
          />

          <button
            type="button"
            className="admin-button"
            onClick={() => void login()}
            disabled={loading}
          >
            {loading ? "验证中..." : "进入后台"}
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
          <Link href="/admin" className="admin-menu-link">
            总览
          </Link>
          <Link href="/admin/posts" className="admin-menu-link">
            文章管理
          </Link>
          <Link href="/admin/photos" className="admin-menu-link">
            相册管理
          </Link>
          <Link href="/photos" className="admin-menu-link">
            查看相册
          </Link>
          <Link href="/" className="admin-menu-link">
            返回首页
          </Link>
        </nav>

        <button type="button" className="admin-logout" onClick={logout}>
          退出后台
        </button>
      </aside>

      <section className="admin-main">{children}</section>
    </div>
  );
}
