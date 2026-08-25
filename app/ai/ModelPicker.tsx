"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  flattenGroups,
  groupModelsByProvider,
  moveActiveIndex,
  type PickerModel,
} from "@/lib/ai-model-picker";
import styles from "./ai-chat.module.css";

export type { PickerModel };

/**
 * 桌面端模型切换器。
 *
 * 为什么不用原生 <select>：选项文案是「供应商 · 模型名 · 视觉 · 思考」，
 * 在顶栏允许的宽度里必然被截断，最先被截掉的恰好是能力标记，
 * 结果是「看不出当前用的是哪个模型，也看不出它能不能读图」。
 * 原生 select 也无法给选项加徽章或按供应商分组，所以这里自己实现弹出菜单。
 *
 * 移动端（<=520px）仍然用侧边栏里的原生 select：抽屉里空间足够，
 * 且原生控件在触屏上的滚轮选择体验比自绘菜单好。
 */
export function ModelPicker({
  models,
  value,
  disabled = false,
  onChange,
}: {
  models: PickerModel[];
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // 键盘高亮项。与鼠标 hover 分开：菜单打开时高亮当前选中项，方便直接上下移动。
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => models.find((model) => model.id === value) || null,
    [models, value]
  );

  const groups = useMemo(() => groupModelsByProvider(models), [models]);
  const flatModels = useMemo(() => flattenGroups(groups), [groups]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // 用 pointerdown 而不是 click：按下即关闭，不会等到抬起，
    // 也不会因为菜单在 click 前被移除而丢掉选择。
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  /**
   * 打开菜单，并把键盘高亮落在当前选中项上。
   *
   * 高亮的初始化放在事件处理里而不是 useEffect 里：effect 内同步 setState 会引发
   * 级联渲染（react-hooks/set-state-in-effect），而「打开」本身就是个事件，
   * 在事件里一次性把两个状态定下来更直接也更准确。
   */
  function openMenu() {
    setActiveIndex(flatModels.findIndex((model) => model.id === value));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    // 这个 effect 只碰 DOM，不写 state：打开时把选中项滚进可视区并接管焦点
    window.requestAnimationFrame(() => {
      listRef.current?.focus();
      listRef.current
        ?.querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [open]);

  function commit(id: string) {
    onChange(id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      // Tab 移出菜单等同于放弃选择，避免焦点跑到菜单后面的内容上
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flatModels.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => moveActiveIndex(current, step, flatModels.length));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : flatModels.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const model = flatModels[activeIndex];
      if (model) commit(model.id);
    }
  }

  if (models.length === 0) return null;

  // 派生而非用 effect 关闭：生成回答时按钮会被禁用，
  // 菜单必须跟着收起，否则会留下一个点不动的悬空面板。
  const menuOpen = open && !disabled;

  return (
    <div className={styles.modelPicker} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.modelPickerButton}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleButtonKeyDown}
        title={selected ? `当前模型：${selected.providerLabel} · ${selected.label}` : "选择模型"}
      >
        <span className={styles.modelPickerLabel}>
          {selected ? (
            <>
              <small>{selected.providerLabel}</small>
              <strong>{selected.label}</strong>
            </>
          ) : (
            <strong>选择模型</strong>
          )}
        </span>
        {selected?.supportsVision ? <em className={styles.modelBadge}>视觉</em> : null}
        {selected?.supportsReasoning ? <em className={styles.modelBadge}>思考</em> : null}
        <b className={styles.modelPickerCaret} aria-hidden="true">▾</b>
      </button>

      {menuOpen ? (
        <div
          ref={listRef}
          className={styles.modelPickerMenu}
          role="listbox"
          tabIndex={-1}
          aria-label="选择模型"
          aria-activedescendant={flatModels[activeIndex] ? `model-option-${flatModels[activeIndex].id}` : undefined}
          onKeyDown={handleListKeyDown}
        >
          {/* 分组必须显式带 role="group"：listbox 的子节点只允许是 option 或 group，
              直接套一层普通 div 会让屏幕阅读器数不出选项个数。
              组名用 aria-labelledby 指向可见文字，避免同一句话重复播报。 */}
          {groups.map((group, groupIndex) => (
            <div
              className={styles.modelPickerGroup}
              key={group.provider}
              role="group"
              // 用下标而不是供应商名做 id：供应商名是后台自由填写的，
              // 含空格或引号时会生成非法 id，选择器随之失效。
              aria-labelledby={`model-group-${groupIndex}`}
            >
              <span className={styles.modelPickerGroupLabel} id={`model-group-${groupIndex}`}>
                {group.provider}
              </span>
              {group.models.map((model) => {
                const isSelected = model.id === value;
                const isActive = flatModels[activeIndex]?.id === model.id;
                return (
                  <div
                    id={`model-option-${model.id}`}
                    key={model.id}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected ? "true" : "false"}
                    data-active={isActive ? "true" : "false"}
                    className={styles.modelPickerOption}
                    onClick={() => commit(model.id)}
                    onMouseEnter={() => setActiveIndex(flatModels.findIndex((item) => item.id === model.id))}
                  >
                    <span className={styles.modelPickerOptionName}>
                      {model.label}
                      {isSelected ? <i aria-hidden="true">✓</i> : null}
                    </span>
                    <span className={styles.modelPickerOptionTags}>
                      {model.supportsVision ? <em className={styles.modelBadge}>视觉</em> : null}
                      {model.supportsReasoning ? <em className={styles.modelBadge}>思考</em> : null}
                      {!model.supportsVision && !model.supportsReasoning
                        ? <em className={styles.modelBadgeMuted}>纯文本</em>
                        : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
