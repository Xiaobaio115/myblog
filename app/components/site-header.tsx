"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  profileName?: string;
  profileTagline?: string;
  profileAvatarUrl?: string;
  profileLocation?: string;
  postCount?: number;
  photoCount?: number;
};

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: "⌂" },
  { href: "/articles", label: "文章", icon: "✎" },
  { href: "/world", label: "我的世界", icon: "◈" },
  { href: "/photos", label: "相册", icon: "✦" },
  { href: "/about", label: "关于我", icon: "◎" },
  { href: "/guestbook", label: "留言", icon: "✉" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function SiteHeader({
  profileName = "LQPP",
  profileTagline = "Stay hungry, stay foolish.",
  profileAvatarUrl = "",
  profileLocation = "",
  postCount = 0,
  photoCount = 0,
}: SiteHeaderProps) {
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;

    router.push(`/articles?q=${encodeURIComponent(keyword)}`);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <>
      <nav className="nav pink-nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo pink-brand">
            <span className="pink-brand-mark" aria-hidden="true">
              <img src="/brand-mark.png" alt="" draggable={false} />
            </span>
            <span>LQPP World</span>
          </Link>

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
              className="theme-toggle pink-search-button"
              aria-label="搜索文章"
              onClick={() => setSearchOpen(true)}
              type="button"
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
              <span className="mobile-menu-icon" aria-hidden="true">☰</span>
              <span className="mobile-menu-label">
                菜单
              </span>
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-nav-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-nav-brand">
              <span>LQPP WORLD</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="关闭导航菜单">
                ×
              </button>
            </div>

            <div className="mobile-nav-profile">
              <div className="mobile-nav-avatar">
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt={profileName}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  <span>{profileName.slice(0, 2)}</span>
                )}
              </div>
              <strong className="mobile-nav-pname">{profileName}</strong>
              <span className="mobile-nav-tagline">{profileTagline}</span>
              {(postCount > 0 || photoCount > 0) && (
                <div className="mobile-nav-stats">
                  <div>
                    <strong>{postCount}</strong>
                    <span>文章</span>
                  </div>
                  <div>
                    <strong>{photoCount}</strong>
                    <span>照片</span>
                  </div>
                  {profileLocation && (
                    <div className="mobile-nav-location">
                      {profileLocation}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mobile-nav-links">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="mobile-nav-link-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          className="search-overlay"
          onClick={() => {
            setSearchOpen(false);
            setQuery("");
          }}
        >
          <div className="search-overlay-box" onClick={(event) => event.stopPropagation()}>
            <form className="search-overlay-form" onSubmit={handleSearch}>
              <span className="search-overlay-icon">
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索文章标题、摘要或标签"
                className="search-overlay-input"
                autoComplete="off"
              />
              <button
                type="button"
                className="search-close-btn"
                aria-label="关闭搜索"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
              >
                ×
              </button>
            </form>
            {query.trim() ? (
              <p className="search-overlay-hint">
                按 <kbd>Enter</kbd> 搜索“{query.trim()}”
              </p>
            ) : (
              <p className="search-overlay-hint">输入关键词后按 Enter 跳转到文章列表。</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
