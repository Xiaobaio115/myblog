import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NAV_ITEMS,
  BUILT_IN_NAV_IDS,
  MAX_NAV_ITEMS,
  createCustomNavItem,
  normalizeNavSetting,
  resolveNavItems,
  visibleNavItems,
} from "../lib/nav-items.ts";

function item(overrides = {}) {
  return { id: "home", href: "/", label: "首页", icon: "⌂", visible: true, ...overrides };
}

test("默认导航里有一个指向 /ai 的入口", () => {
  const ai = DEFAULT_NAV_ITEMS.find((entry) => entry.href === "/ai");
  assert.ok(ai, "默认导航应该带 AI 入口");
  assert.equal(ai.visible, true);
  assert.ok(BUILT_IN_NAV_IDS.has(ai.id));
});

test("默认导航项 id 不重复", () => {
  const ids = new Set(DEFAULT_NAV_ITEMS.map((entry) => entry.id));
  assert.equal(ids.size, DEFAULT_NAV_ITEMS.length);
});

test("normalize 接受合法配置并补齐缺省字段", () => {
  const result = normalizeNavSetting([{ id: "home", href: "/", label: "首页" }]);
  assert.deepEqual(result, [{ id: "home", href: "/", label: "首页", icon: "◆", visible: true }]);
});

test("normalize 去掉首尾空格", () => {
  const result = normalizeNavSetting([{ id: " home ", href: " /articles ", label: " 文章 ", icon: " ✎ " }]);
  assert.deepEqual(result, [{ id: "home", href: "/articles", label: "文章", icon: "✎", visible: true }]);
});

test("normalize 保留 visible: false", () => {
  const result = normalizeNavSetting([item(), item({ id: "ai", href: "/ai", label: "甘蔗 AI", visible: false })]);
  assert.equal(result.length, 2);
  assert.equal(result[1].visible, false);
});

test("normalize 拒绝空数组与超量数组", () => {
  assert.equal(normalizeNavSetting([]), null);
  const tooMany = Array.from({ length: MAX_NAV_ITEMS + 1 }, (_, index) => item({ id: `n${index}` }));
  assert.equal(normalizeNavSetting(tooMany), null);
});

test("normalize 拒绝非数组", () => {
  for (const value of [null, undefined, {}, "nav", 42]) {
    assert.equal(normalizeNavSetting(value), null);
  }
});

test("normalize 拒绝缺名称或缺路径的项", () => {
  assert.equal(normalizeNavSetting([item({ label: "" })]), null);
  assert.equal(normalizeNavSetting([item({ label: "   " })]), null);
  assert.equal(normalizeNavSetting([item({ href: "" })]), null);
  assert.equal(normalizeNavSetting([item({ id: "" })]), null);
});

test("normalize 拒绝站外链接和协议型 href", () => {
  for (const href of ["https://evil.example", "//evil.example", "javascript:alert(1)", "articles", "\\\\evil"]) {
    assert.equal(normalizeNavSetting([item({ href })]), null, `应拒绝 ${href}`);
  }
});

test("normalize 拒绝过长的名称与图标", () => {
  assert.equal(normalizeNavSetting([item({ label: "字".repeat(21) })]), null);
  assert.equal(normalizeNavSetting([item({ icon: "★".repeat(9) })]), null);
});

test("normalize 拒绝重复 id", () => {
  assert.equal(normalizeNavSetting([item(), item({ href: "/articles", label: "文章" })]), null);
});

test("normalize 拒绝全部隐藏的配置", () => {
  assert.equal(normalizeNavSetting([item({ visible: false })]), null);
});

test("resolveNavItems 在配置缺失或损坏时回落到默认导航", () => {
  for (const value of [null, undefined, [], {}, [{ id: "x" }], [item({ visible: false })]]) {
    assert.deepEqual(resolveNavItems(value), DEFAULT_NAV_ITEMS);
  }
});

test("resolveNavItems 保留存量顺序，并把代码里新增的默认项补在后面", () => {
  const stored = [
    item({ id: "ai", href: "/ai", label: "甘蔗 AI", icon: "✳" }),
    item({ id: "home", href: "/", label: "主页", icon: "⌂" }),
  ];
  const resolved = resolveNavItems(stored);

  assert.equal(resolved[0].id, "ai");
  assert.equal(resolved[1].id, "home");
  // 存量里改过的名字不能被默认值盖回去。
  assert.equal(resolved[1].label, "主页");
  // 其余内置项按默认顺序补齐，不会因为老数据里没有就消失。
  assert.equal(resolved.length, DEFAULT_NAV_ITEMS.length);
  for (const id of BUILT_IN_NAV_IDS) {
    assert.ok(resolved.some((entry) => entry.id === id), `缺了内置项 ${id}`);
  }
});

test("resolveNavItems 保留自定义项", () => {
  const custom = item({ id: "custom-1", href: "/guestbook", label: "联系我", icon: "✉" });
  const resolved = resolveNavItems([item(), custom]);
  assert.ok(resolved.some((entry) => entry.id === "custom-1" && entry.label === "联系我"));
});

test("resolveNavItems 补回来的项沿用默认的显示状态", () => {
  const resolved = resolveNavItems([item()]);
  const ai = resolved.find((entry) => entry.id === "ai");
  assert.equal(ai.visible, true);
});

test("visibleNavItems 过滤隐藏项", () => {
  const items = [item(), item({ id: "ai", href: "/ai", label: "甘蔗 AI", visible: false })];
  const shown = visibleNavItems(items);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, "home");
});

test("visibleNavItems 在一项都不显示时回落到默认导航，避免出现空导航栏", () => {
  const shown = visibleNavItems([item({ visible: false })]);
  assert.deepEqual(shown, DEFAULT_NAV_ITEMS.filter((entry) => entry.visible));
  assert.ok(shown.length > 0);
});

test("createCustomNavItem 产出的项能通过校验", () => {
  const created = createCustomNavItem("custom-abc");
  assert.equal(created.visible, true);
  assert.deepEqual(normalizeNavSetting([created]), [created]);
  // 新建项不应该被当成内置项，否则后台的删除按钮会被永久禁用。
  assert.equal(BUILT_IN_NAV_IDS.has(created.id), false);
});
