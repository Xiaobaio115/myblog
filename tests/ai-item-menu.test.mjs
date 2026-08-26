import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMenuAnchor,
  firstEnabledIndex,
  lastEnabledIndex,
  moveMenuIndex,
} from "../lib/ai-item-menu.ts";

const VIEWPORT = { width: 1280, height: 800 };

test("下方空间充足时向下展开", () => {
  const anchor = computeMenuAnchor({ top: 100, bottom: 128, right: 300 }, VIEWPORT, 2);
  assert.equal(anchor.flip, false);
  assert.equal(anchor.top, 132);
});

test("贴着视口底部时向上展开", () => {
  const anchor = computeMenuAnchor({ top: 760, bottom: 788, right: 300 }, VIEWPORT, 3);
  assert.equal(anchor.flip, true);
  assert.equal(anchor.top, 756);
});

test("按钮在视口顶部且下方也不够时不向上翻，否则菜单会跑出视口", () => {
  // 上方只有 10px，下方 30px：即使下方放不下 3 项，也应该向下展开
  const anchor = computeMenuAnchor({ top: 10, bottom: 38, right: 300 }, { width: 1280, height: 68 }, 3);
  assert.equal(anchor.flip, false);
});

test("项数越多越容易向上翻", () => {
  const rect = { top: 700, bottom: 728, right: 300 };
  assert.equal(computeMenuAnchor(rect, VIEWPORT, 1).flip, false);
  assert.equal(computeMenuAnchor(rect, VIEWPORT, 4).flip, true);
});

test("right 至少留 8px 边距", () => {
  assert.equal(computeMenuAnchor({ top: 10, bottom: 38, right: 1280 }, VIEWPORT, 2).right, 8);
  assert.equal(computeMenuAnchor({ top: 10, bottom: 38, right: 1300 }, VIEWPORT, 2).right, 8);
  assert.equal(computeMenuAnchor({ top: 10, bottom: 38, right: 1000 }, VIEWPORT, 2).right, 280);
});

test("高亮移动跳过禁用项", () => {
  const disabled = [false, true, false];
  assert.equal(moveMenuIndex(0, 1, disabled), 2);
  assert.equal(moveMenuIndex(2, 1, disabled), 0);
  assert.equal(moveMenuIndex(0, -1, disabled), 2);
});

test("全部禁用时高亮不动，且不死循环", () => {
  assert.equal(moveMenuIndex(1, 1, [true, true, true]), 1);
  assert.equal(moveMenuIndex(-1, 1, [true]), -1);
});

test("空列表安全返回", () => {
  assert.equal(moveMenuIndex(-1, 1, []), -1);
  assert.equal(firstEnabledIndex([]), -1);
  assert.equal(lastEnabledIndex([]), -1);
});

test("首尾可用项定位", () => {
  assert.equal(firstEnabledIndex([true, false, false]), 1);
  assert.equal(lastEnabledIndex([false, false, true]), 1);
  assert.equal(firstEnabledIndex([true, true]), -1);
  assert.equal(lastEnabledIndex([true, true]), -1);
});
