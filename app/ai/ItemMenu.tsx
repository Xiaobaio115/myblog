"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  computeMenuAnchor,
  firstEnabledIndex,
  lastEnabledIndex,
  moveMenuIndex,
  type MenuAnchor,
} from "@/lib/ai-item-menu";
import styles from "./ai-chat.module.css";

export type ItemMenuAction = {
  key: string;
  label: string;
  /** 危险操作单独描红，并与其他项之间留一道分隔线 */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * 会话条目上的「⋯」菜单。
 *
 * 为什么不把删除键直接摆在列表项上：删除键紧贴着「打开会话」的点击区，
 * 在触屏上两者只差几毫米，误触的代价是永久丢一条会话。藏进菜单后，
 * 删除需要两次明确操作（展开菜单、点删除项），而打开会话仍然是一次点击。
 *
 * 交互约定与 ModelPicker 保持一致：pointerdown 关闭、Esc 关闭并归还焦点、
 * 上下键在项间移动。不在 effect 里写 state，避免 react-hooks/set-state-in-effect。
 */
export function ItemMenu({
  actions,
  label,
  className,
}: {
  actions: ItemMenuAction[];
  /** 无障碍名称，需带上所属会话标题，否则列表里几十个「更多操作」无法区分 */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /**
   * 菜单用 position: fixed 而不是 absolute。
   *
   * 会话列表容器是 overflow-y: auto，absolute 定位的菜单会被容器裁掉，
   * 列表最后几项的菜单基本看不见。fixed 脱离了裁剪上下文，代价是要自己算坐标，
   * 并且在滚动时关闭（否则菜单会停在原地不跟随列表）。
   */
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    // fixed 定位的菜单不跟随滚动，所以滚动时直接关掉，避免菜单飘在错误的位置。
    // 用捕获阶段：滚动的是内层列表容器，事件不会冒泡到 window。
    const handleScroll = () => setOpen(false);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // 只碰 DOM，不写 state
    window.requestAnimationFrame(() => listRef.current?.focus());
  }, [open]);

  function openMenu(index: number) {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor(
      computeMenuAnchor(
        { top: rect.top, bottom: rect.bottom, right: rect.right },
        { width: window.innerWidth, height: window.innerHeight },
        actions.length
      )
    );
    setActiveIndex(index);
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    setActiveIndex(-1);
    setAnchor(null);
    if (focusButton) buttonRef.current?.focus();
  }

  function commit(action: ItemMenuAction) {
    if (action.disabled) return;
    // 先关菜单：onSelect 可能弹确认框或让这一项从列表里消失，
    // 那时菜单的 DOM 已经不存在，再去设它的 state 就是对已卸载节点操作。
    close(false);
    action.onSelect();
  }

  const disabledFlags = actions.map((action) => action.disabled === true);

  function moveBy(step: number) {
    setActiveIndex((current) => moveMenuIndex(current, step, disabledFlags));
  }

  if (actions.length === 0) return null;

  return (
    <div className={`${styles.itemMenu} ${className || ""}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.itemMenuButton}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // 阻止冒泡：菜单键叠在「打开会话」按钮所在的行里，
          // 冒泡上去会顺带切换会话。
          event.stopPropagation();
          if (open) close();
          else openMenu(firstEnabledIndex(disabledFlags));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openMenu(firstEnabledIndex(disabledFlags));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(lastEnabledIndex(disabledFlags));
          }
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && anchor ? (
        <div
          id={menuId}
          ref={listRef}
          className={styles.itemMenuList}
          role="menu"
          tabIndex={-1}
          style={{
            top: anchor.top,
            right: anchor.right,
            // flip 时用 translateY(-100%) 让菜单底边贴住按钮上沿，
            // 这样不必知道菜单真实高度也能正确向上展开。
            transform: anchor.flip ? "translateY(-100%)" : undefined,
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Tab") {
              close(false);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveBy(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveBy(-1);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const action = actions[activeIndex];
              if (action) commit(action);
            }
          }}
        >
          {actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              data-active={index === activeIndex}
              className={action.danger ? styles.itemMenuDanger : undefined}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={(event) => {
                event.stopPropagation();
                commit(action);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
