// 用相对路径而不是 @/ 别名：这个文件要能被 tests/ 下的 node:test 直接 import，
// 而 node 不认 tsconfig 里的 paths。
import { isSafeInternalHref } from "./internal-href.ts";

export type NavItemSetting = {
  /** 稳定标识。内置项用固定值，改名换路径都不影响它和代码默认项的对应关系。 */
  id: string;
  href: string;
  label: string;
  /** 只在移动端抽屉里显示的字形。 */
  icon: string;
  /** 后台的显示开关。隐藏的项不渲染，但配置还留着，随时可以打开。 */
  visible: boolean;
};

/**
 * 代码里的默认导航。数据库没配过、或配置存坏了，前台就用这一份。
 * 顺序即默认展示顺序。
 */
export const DEFAULT_NAV_ITEMS: NavItemSetting[] = [
  { id: "home", href: "/", label: "首页", icon: "⌂", visible: true },
  { id: "articles", href: "/articles", label: "文章", icon: "✎", visible: true },
  { id: "series", href: "/series", label: "系列", icon: "≋", visible: true },
  { id: "world", href: "/world", label: "我的世界", icon: "◈", visible: true },
  { id: "photos", href: "/photos", label: "相册", icon: "✦", visible: true },
  { id: "about", href: "/about", label: "关于我", icon: "◎", visible: true },
  { id: "projects", href: "/projects", label: "项目", icon: "▤", visible: true },
  { id: "guestbook", href: "/guestbook", label: "留言", icon: "✉", visible: true },
  // 悬浮的「问甘蔗」小窗依旧保留，这里只是多开一个直达完整对话页的入口。
  { id: "ai", href: "/ai", label: "甘蔗 AI", icon: "✳", visible: true },
];

/** 内置项在后台只能隐藏、不能删除：删了会被下面的合并逻辑重新补回来，看起来像 bug。 */
export const BUILT_IN_NAV_IDS: ReadonlySet<string> = new Set(DEFAULT_NAV_ITEMS.map((item) => item.id));

export const MAX_NAV_ITEMS = 20;
const MAX_LABEL_LENGTH = 20;
const MAX_ICON_LENGTH = 8;
const MAX_ID_LENGTH = 60;

export function createCustomNavItem(id: string): NavItemSetting {
  return { id, href: "/", label: "新导航项", icon: "◆", visible: true };
}

function normalizeItem(value: unknown): NavItemSetting | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;

  const id = typeof source.id === "string" ? source.id.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";
  const href = typeof source.href === "string" ? source.href.trim() : "";
  const icon = typeof source.icon === "string" ? source.icon.trim() : "";

  if (!id || id.length > MAX_ID_LENGTH) return null;
  if (!label || label.length > MAX_LABEL_LENGTH) return null;
  if (icon.length > MAX_ICON_LENGTH) return null;
  // 导航项只允许站内路径。外链走社交链接那一栏，这里放开等于把 href 变成一个可写的跳转位。
  if (!isSafeInternalHref(href)) return null;

  return { id, href, label, icon: icon || "◆", visible: source.visible !== false };
}

/**
 * 写入前的严格校验。任何一项不合格就整体拒绝，
 * 免得一次保存只落一半、前台navigation 半新半旧。
 */
export function normalizeNavSetting(value: unknown): NavItemSetting[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NAV_ITEMS) return null;

  const normalized: NavItemSetting[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    const next = normalizeItem(item);
    if (!next) return null;
    // id 重复会让 React key 撞车，也会让下面的合并逻辑判断不出该补哪一项。
    if (seenIds.has(next.id)) return null;
    seenIds.add(next.id);
    normalized.push(next);
  }

  // 全隐藏大概率是误操作，而不是有人真想要一个空导航栏。
  if (!normalized.some((item) => item.visible)) return null;

  return normalized;
}

/**
 * 把库里存的配置和代码里的默认项合起来。
 * 存量顺序优先，代码里新加的项（比如以后再加一个入口）按默认顺序补在后面，
 * 这样上线新页面不用先去后台点一下才能看见。
 */
export function resolveNavItems(stored: unknown): NavItemSetting[] {
  const normalized = normalizeNavSetting(stored);
  if (!normalized) return DEFAULT_NAV_ITEMS;

  const storedIds = new Set(normalized.map((item) => item.id));
  const missing = DEFAULT_NAV_ITEMS.filter((item) => !storedIds.has(item.id));

  return [...normalized, ...missing];
}

export function visibleNavItems(items: NavItemSetting[]): NavItemSetting[] {
  const shown = items.filter((item) => item.visible);
  return shown.length > 0 ? shown : DEFAULT_NAV_ITEMS.filter((item) => item.visible);
}
