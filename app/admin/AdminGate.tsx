"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/app/components/theme-toggle";

const navGroups = [
  {
    title: "内容中心",
    items: [
      { href: "/admin", label: "控制台", desc: "全局概览", code: "OV" },
      { href: "/admin/posts", label: "文章", desc: "发布与编辑", code: "PO" },
      { href: "/admin/posts/new", label: "写文章", desc: "新建内容", code: "NW" },
      { href: "/admin/photos", label: "相册", desc: "上传与分组", code: "PH" },
      { href: "/admin/guestbook", label: "留言", desc: "审核与处理", code: "GB" },
    ],
  },
  {
    title: "站点配置",
    items: [
      { href: "/admin/settings", label: "站点设置", desc: "资料与模块", code: "ST" },
      { href: "/admin/travel-map", label: "旅行地图", desc: "城市与照片", code: "MP" },
      { href: "/", label: "前台预览", desc: "打开网站", code: "PV" },
      { href: "/photos", label: "相册预览", desc: "查看前台", code: "AL" },
    ],
  },
];

const flatNavItems = navGroups.flatMap((group) => group.items);

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
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const currentModule = useMemo(() => {
    return (
      flatNavItems.find(
        (item) =>
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
      ) || flatNavItems[0]
    );
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function verifyStoredPassword() {
      if (!storedPassword) {
        setVerified(false);
        setReady(true);
        return;
      }

      setReady(false);
      try {
        const response = await fetch("/api/auth", {
          headers: { "x-admin-password": storedPassword },
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.ok) {
          setVerified(true);
        } else {
          localStorage.removeItem("admin_password");
          window.dispatchEvent(new Event("admin-password-change"));
          setVerified(false);
        }
      } catch {
        if (!cancelled) setVerified(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void verifyStoredPassword();

    return () => {
      cancelled = true;
    };
  }, [storedPassword]);

  async function login() {
    if (!password.trim()) {
      setLoginError("请输入后台密码。");
      return;
    }

    setLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      });

      if (!response.ok) {
        setLoginError("密码不正确，请重新输入。");
        return;
      }

      localStorage.setItem("admin_password", password);
      window.dispatchEvent(new Event("admin-password-change"));
      setVerified(true);
      setPassword("");
    } catch {
      setLoginError("无法连接验证接口，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("admin_password");
    setPassword("");
    setVerified(false);
    window.dispatchEvent(new Event("admin-password-change"));
  }

  if (!ready) {
    return (
      <main className="admin-login-screen">
        <section className="admin-login-shell compact">
          <div className="admin-login-copy">
            <div className="admin-product-mark">LQPP ADMIN</div>
            <h1>正在验证访问权限</h1>
            <p>请稍候，系统正在确认当前后台会话。</p>
          </div>
        </section>
      </main>
    );
  }

  if (!verified) {
    return (
      <main className="admin-login-screen">
        <section className="admin-login-shell">
          <div className="admin-login-copy">
            <div className="admin-product-mark">LQPP ADMIN</div>
            <h1>内容管理后台</h1>
            <p>这里用于管理文章、相册、留言、旅行地图和站点资料。只有验证通过后才能进入。</p>
            <div className="admin-login-notes">
              <span>访问控制</span>
              <strong>后台密码验证</strong>
              <small>上传、删除、审核等接口仍会在服务端再次校验密码。</small>
            </div>
          </div>

          <div className="admin-login-form">
            <label>
              <span>后台密码</span>
              <input
                type="password"
                className="admin-input"
                placeholder="输入后台密码"
                value={password}
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void login();
                  }
                }}
              />
            </label>

            {loginError ? <p className="admin-login-error">{loginError}</p> : null}

            <div className="admin-actions">
              <button type="button" className="admin-button" onClick={() => void login()} disabled={loading}>
                {loading ? "验证中..." : "进入后台"}
              </button>
              <Link href="/" className="secondary-link">
                返回首页
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell admin-system-shell">
      <aside className="admin-sidebar admin-system-sidebar">
        <Link href="/admin" className="admin-brand admin-system-brand">
          <span>LQPP</span>
          <small>Content Console</small>
        </Link>

        <nav className="admin-menu admin-system-menu">
          {navGroups.map((group) => (
            <div key={group.title} className="admin-menu-group">
              <div className="admin-menu-title">{group.title}</div>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-menu-link admin-system-link${active ? " active" : ""}`}
                  >
                    <span className="admin-link-code">{item.code}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.desc}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-bottom admin-system-session">
          <div>
            <strong>管理员会话</strong>
            <span>当前访问已验证</span>
          </div>
          <button type="button" className="secondary-link admin-logout" onClick={logout}>
            退出后台
          </button>
        </div>
      </aside>

      <section className="admin-main admin-system-main">
        <header className="admin-system-topbar">
          <div>
            <div className="admin-breadcrumb">后台 / {currentModule.label}</div>
            <strong>{currentModule.label}</strong>
            <span>{currentModule.desc}</span>
          </div>
          <div className="admin-topbar-actions">
            <ThemeToggle />
            <Link href="/" className="secondary-link">
              预览站点
            </Link>
            <Link href="/admin/posts/new" className="admin-button">
              新建文章
            </Link>
          </div>
        </header>
        <div className="admin-system-content">{children}</div>
      </section>
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
