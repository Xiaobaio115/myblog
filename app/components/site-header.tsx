"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/app/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/articles", label: "文章" },
  { href: "/photos", label: "相册" },
  { href: "/world", label: "我的世界" },
  { href: "/about", label: "关于我" },
  { href: "/guestbook", label: "留言" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSearchOpen(false); setMenuOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/articles?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  };

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">LQPP World</Link>

          <div className="nav-links">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-btn ${isActive(pathname, item.href) ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="nav-actions">
            <button
              className="theme-toggle"
              aria-label="搜索文章"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="打开导航菜单"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-brand">
              <span>LQPP</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="关闭导航菜单">
                ✕
              </button>
            </div>
            <div className="mobile-nav-avatar">LQPP</div>
            <strong className="mobile-nav-name">LQPP World</strong>
            <div className="mobile-nav-links">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mobile-nav-socials">
              <span>GitHub</span>
              <span>Mail</span>
              <span>RSS</span>
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          className="search-overlay"
          onClick={() => { setSearchOpen(false); setQuery(""); }}
        >
          <div className="search-overlay-box" onClick={(e) => e.stopPropagation()}>
            <form className="search-overlay-form" onSubmit={handleSearch}>
              <span className="search-overlay-icon"><SearchIcon /></span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文章标题、标签…"
                className="search-overlay-input"
                autoComplete="off"
              />
              <button
                type="button"
                className="search-close-btn"
                aria-label="关闭搜索"
                onClick={() => { setSearchOpen(false); setQuery(""); }}
              >
                ✕
              </button>
            </form>
            {query.trim() && (
              <p className="search-overlay-hint">
                按 <kbd>Enter</kbd> 搜索「{query.trim()}」
              </p>
            )}
            {!query.trim() && (
              <p className="search-overlay-hint">输入关键词，按 Enter 跳转文章列表</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
