"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const navItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/posts", label: "文章管理" },
  { href: "/admin/posts/new", label: "新建文章" },
  { href: "/admin/photos", label: "相册管理" },
  { href: "/articles", label: "查看文章" },
  { href: "/photos", label: "查看相册" },
];

export default function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const storedPassword = useSyncExternalStore(
    subscribeToAdminPassword,
    getAdminPasswordSnapshot,
    () => ""
  );
  const [password, setPassword] = useState("");
  const authed = Boolean(storedPassword);

  function login() {
    if (!password.trim()) {
      alert("请输入后台密码。");
      return;
    }

    localStorage.setItem("admin_password", password);
    window.dispatchEvent(new Event("admin-password-change"));
  }

  function logout() {
    localStorage.removeItem("admin_password");
    setPassword("");
    window.dispatchEvent(new Event("admin-password-change"));
  }

  if (!authed) {
    return (
      <main className="admin-page">
        <div className="admin-panel narrow admin-login-card">
          <div className="section-head">
            <div>
              <div className="admin-kicker">LUNA NOTES ADMIN</div>
              <h1 className="section-title">后台登录</h1>
              <p className="section-copy">输入一次后台密码后，就可以进入文章和相册管理。</p>
            </div>
          </div>

          <input
            type="password"
            className="admin-input"
            placeholder="输入后台密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                login();
              }
            }}
          />

          <div className="admin-actions">
            <button type="button" className="admin-button" onClick={login}>
              进入后台
            </button>
            <Link href="/" className="secondary-link">
              返回首页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          LUNA NOTES
        </Link>

        <nav className="admin-menu">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-menu-link${active ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button type="button" className="secondary-link admin-logout" onClick={logout}>
          退出后台
        </button>
      </aside>

      <section className="admin-main">{children}</section>
    </div>
  );
}

function subscribeToAdminPassword(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener("admin-password-change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("admin-password-change", handleChange);
  };
}

function getAdminPasswordSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("admin_password") || "";
}
