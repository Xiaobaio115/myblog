/**
 * 「⋯」菜单的定位与键盘移动的纯逻辑。
 *
 * 抽出来是因为组件本身是 "use client" + JSX，node:test 无法直接 import；
 * 而这里的边界条件（贴着视口底部展开、跳过禁用项）恰恰是最容易写错的部分。
 */

export type MenuRect = { top: number; bottom: number; right: number };
export type MenuViewport = { width: number; height: number };
export type MenuAnchor = { top: number; right: number; flip: boolean };

/** 每项高度与容器内边距的估算值，用于判断下方空间是否够放 */
const ITEM_HEIGHT = 32;
const LIST_PADDING = 8;
const GAP = 4;
/** 菜单右边至少离视口边缘这么远，避免贴边 */
const MIN_EDGE = 8;

/**
 * 算出菜单该出现在哪里。
 *
 * 只有「下方放不下，且上方比下方宽敞」时才向上翻。只判断放不下就翻会导致
 * 一个更糟的结果：按钮在视口顶部附近时向上翻，菜单直接跑到视口外面。
 */
export function computeMenuAnchor(
  rect: MenuRect,
  viewport: MenuViewport,
  itemCount: number
): MenuAnchor {
  const estimated = itemCount * ITEM_HEIGHT + LIST_PADDING;
  const spaceBelow = viewport.height - rect.bottom;
  const flip = spaceBelow < estimated + GAP && rect.top > spaceBelow;
  return {
    top: flip ? rect.top - GAP : rect.bottom + GAP,
    right: Math.max(MIN_EDGE, viewport.width - rect.right),
    flip,
  };
}

/**
 * 在可用项之间移动高亮，跳过禁用项。
 *
 * 全部禁用时返回原值而不是死循环：最多走一圈就停。
 */
export function moveMenuIndex(
  current: number,
  step: number,
  disabled: boolean[]
): number {
  const total = disabled.length;
  if (total === 0) return current;
  let next = current;
  for (let hop = 0; hop < total; hop += 1) {
    next = (next + step + total) % total;
    if (!disabled[next]) return next;
  }
  return current;
}

/** 首个可用项的下标，没有可用项时返回 -1 */
export function firstEnabledIndex(disabled: boolean[]): number {
  return disabled.findIndex((value) => !value);
}

/** 末个可用项的下标，没有可用项时返回 -1 */
export function lastEnabledIndex(disabled: boolean[]): number {
  return disabled.reduce((last, value, index) => (value ? last : index), -1);
}
