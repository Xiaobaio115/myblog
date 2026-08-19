"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { AdminApiError, adminFetch, clearAdminPassword, getAdminPassword, setAdminPassword, subscribeToAdminPassword } from "@/lib/admin-api";
import styles from "./admin-shell.module.css";

const navGroups = [
  { title: "内容管理", items: [
    { href: "/admin", label: "总览", desc: "工作台", code: "◉" },
    { href: "/admin/posts", label: "文章", desc: "发布与编辑", code: "▤" },
    { href: "/admin/series", label: "系列", desc: "连载目录", code: "≋" },
    { href: "/admin/photos", label: "相册", desc: "上传与分组", code: "✦" },
    { href: "/admin/guestbook", label: "留言", desc: "审核与处理", code: "✉" },
  ] },
  { title: "站点系统", items: [
    { href: "/admin/travel-map", label: "旅行地图", desc: "城市与照片", code: "◈" },
    { href: "/admin/chat-notifications", label: "AI 与通知", desc: "模型与转发", code: "⚡" },
    { href: "/admin/ai-conversations", label: "AI 会话", desc: "记录与清理", code: "◌" },
    { href: "/admin/settings", label: "站点设置", desc: "资料与模块", code: "⚙" },
  ] },
  { title: "快捷入口", items: [
    { href: "/admin/posts/new", label: "写文章", desc: "新建内容", code: "✎" },
    { href: "/", label: "预览站点", desc: "打开前台", code: "↗" },
  ] },
];
const flatNavItems = navGroups.flatMap((group) => group.items);

function resolveCurrentModule(pathname: string) {
  const exactMatch = flatNavItems.find((item) => pathname === item.href);
  if (exactMatch) return exactMatch;

  return [...flatNavItems]
    .filter(
      (item) =>
        item.href !== "/" &&
        item.href !== "/admin" &&
        pathname.startsWith(`${item.href}/`)
    )
    .sort((left, right) => right.href.length - left.href.length)[0] || flatNavItems[0];
}

export default function AdminGate({ children, serverAuthenticated = false }: { children: React.ReactNode; serverAuthenticated?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const storedPassword = useSyncExternalStore(subscribeToAdminPassword, getAdminPassword, () => "");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const currentModule = useMemo(() => resolveCurrentModule(pathname), [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!storedPassword) { setVerified(false); setReady(true); return; }
      setReady(false);
      try {
        await adminFetch("/api/auth", { password: storedPassword });
        if (!cancelled) {
          setVerified(true);
          setLoginError("");
          if (!serverAuthenticated) router.refresh();
        }
      } catch (error) {
        const isRejectedCredential =
          error instanceof AdminApiError && [401, 403].includes(error.status);

        if (isRejectedCredential) clearAdminPassword();
        if (!cancelled) {
          setVerified(false);
          setLoginError(
            isRejectedCredential
              ? "后台密码已失效，请重新输入。"
              : "暂时无法验证当前会话，请稍后重试。"
          );
        }
      } finally { if (!cancelled) setReady(true); }
    }
    void verify();
    return () => { cancelled = true; };
  }, [router, serverAuthenticated, storedPassword, verificationAttempt]);

  async function login() {
    const nextPassword = password.trim();
    if (!nextPassword) { setLoginError("请输入后台密码。"); return; }
    setLoading(true); setLoginError("");
    try {
      await adminFetch("/api/auth", { password: nextPassword, fallbackError: "密码不正确，请重新输入。" });
      setAdminPassword(nextPassword); setVerified(true); setPassword(""); router.refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "无法连接验证接口。");
    } finally { setLoading(false); }
  }

  async function logout() {
    clearAdminPassword();
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // The local credential has already been cleared; continue logging out.
    }
    setPassword("");
    setVerified(false);
    router.refresh();
  }

  if (!ready) return <main className={styles.loginScreen}><section className={`${styles.loginShell} ${styles.compact}`}><div className={styles.loginCopy}><div className={styles.loginMark}>LQPP ADMIN</div><h1>正在验证</h1><p>正在确认当前后台会话。</p></div></section></main>;

  if (!verified) return (
    <main className={styles.loginScreen}>
      <section className={styles.loginShell}>
        <div className={styles.loginCopy}>
          <div className={styles.loginMark}>LQPP ADMIN</div><h1>内容工作台</h1><p>管理文章、照片、留言、旅行地图与站点配置。</p>
          <div className={styles.loginNote}><span>访问控制</span><strong>后台密码验证</strong><small>上传、删除和审核接口仍会在服务端再次校验。</small></div>
        </div>
        <div className={styles.loginForm}>
          <label><span>后台密码</span><input type="password" className="admin-input" placeholder="输入后台密码" value={password} autoFocus onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void login(); }} /></label>
          {loginError ? <p className={styles.error}>{loginError}</p> : null}
          <div className={styles.loginActions}>
            <button type="button" className="admin-button" onClick={() => void login()} disabled={loading}>{loading ? "验证中..." : "进入后台"}</button>
            {storedPassword ? <button type="button" className="secondary-link" onClick={() => setVerificationAttempt((value) => value + 1)}>重新验证</button> : null}
            <Link href="/" className="secondary-link">返回首页</Link>
          </div>
        </div>
      </section>
    </main>
  );

  return (
    <div className={styles.shell}>
      <button type="button" aria-label="关闭导航" className={`${styles.overlay} ${menuOpen ? styles.overlayOpen : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <Link href="/admin" className={styles.brand}><span>LQPP</span><small>Content Console</small></Link>
        <nav className={styles.nav} aria-label="后台导航">
          {navGroups.map((group) => <div key={group.title} className={styles.navGroup}><div className={styles.navTitle}>{group.title}</div>{group.items.map((item) => {
            const active = currentModule.href === item.href;
            const className = `${styles.navLink} ${active ? styles.navLinkActive : ""}`;
            const content = <><span className={styles.navCode}>{item.code}</span><span className={styles.navLabel}>{item.label}</span></>;

            return item.href.includes("?")
              ? <a key={item.href} href={item.href} title={item.desc} onClick={() => setMenuOpen(false)} className={className}>{content}</a>
              : <Link key={item.href} href={item.href} title={item.desc} onClick={() => setMenuOpen(false)} className={className}>{content}</Link>;
          })}</div>)}
        </nav>
        <div className={styles.sidebarFoot}><div className={styles.session}><strong>管理员</strong><span>已验证</span></div><button type="button" className={styles.logout} onClick={() => void logout()}>退出</button></div>
      </aside>
      <section className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.menuButton} aria-label="打开导航" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>☰</button>
          <div className={styles.topbarInfo}><div className={styles.breadcrumb}>后台 / {currentModule.label}</div><strong>{currentModule.label}</strong><span>{currentModule.desc}</span></div>
          <div className={styles.topbarActions}><ThemeToggle /><Link href="/" className="secondary-link">预览站点</Link><Link href="/admin/posts/new" className="admin-button">新建文章</Link></div>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </div>
  );
}
