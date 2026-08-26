"use client";

import { BUILT_IN_NAV_IDS, MAX_NAV_ITEMS, createCustomNavItem, type NavItemSetting } from "@/lib/nav-items";

function newItemId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `custom-${crypto.randomUUID()}`
    : `custom-${Date.now()}`;
}

// 44px 是手指能稳定点到的下限。后台在手机上也会用，上下移和删除挨得近，点错代价不小。
const squareButton = { width: 44, minWidth: 44, minHeight: 44, padding: 0, flexShrink: 0 } as const;

export function NavForm({ value, saving, onChange, onSave }: {
  value: NavItemSetting[];
  saving: boolean;
  onChange: (value: NavItemSetting[]) => void;
  onSave: (value: NavItemSetting[]) => void;
}) {
  const visibleCount = value.filter((item) => item.visible).length;

  function update(index: number, patch: Partial<NavItemSetting>) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="settings-col">
      <div>
        <h2>导航栏</h2>
        <p className="settings-help">
          勾掉「显示」就把这一项从导航栏隐藏，配置还留着，随时能再打开。顺序就是前台展示顺序。
          图标只在手机菜单里出现。内置项只能隐藏、不能删除。
        </p>
      </div>

      {value.map((item, index) => {
        const builtIn = BUILT_IN_NAV_IDS.has(item.id);
        const lastVisible = item.visible && visibleCount <= 1;

        return (
          <section key={item.id} className="settings-list-item" aria-labelledby={`nav-item-title-${item.id}`}>
            {/* 名称可能长到 20 字，窄屏让它自己换到上一行，别把三个按钮挤变形 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong id={`nav-item-title-${item.id}`} style={{ marginRight: "auto", minWidth: 0 }}>
                {item.label || `导航项 ${index + 1}`}
                {builtIn ? null : (
                  <span style={{ marginLeft: 8, opacity: 0.65, fontSize: "0.78rem", fontWeight: 600 }}>
                    自定义
                  </span>
                )}
              </strong>
              <button
                type="button"
                className="secondary-link"
                style={squareButton}
                disabled={index === 0}
                title="上移"
                aria-label={`将「${item.label}」上移`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary-link"
                style={squareButton}
                disabled={index === value.length - 1}
                title="下移"
                aria-label={`将「${item.label}」下移`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="danger-btn"
                style={squareButton}
                disabled={builtIn}
                title={builtIn ? "内置项不能删除，取消勾选「显示」即可隐藏" : "删除"}
                aria-label={`删除「${item.label}」`}
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                ×
              </button>
            </div>

            <div className="settings-row3">
              <div>
                <label htmlFor={`nav-label-${item.id}`}>名称</label>
                <input
                  id={`nav-label-${item.id}`}
                  className="admin-input"
                  value={item.label}
                  maxLength={20}
                  placeholder="导航文字"
                  onChange={(event) => update(index, { label: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`nav-href-${item.id}`}>路径</label>
                <input
                  id={`nav-href-${item.id}`}
                  className="admin-input"
                  value={item.href}
                  placeholder="/articles"
                  onChange={(event) => update(index, { href: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`nav-icon-${item.id}`}>图标（手机菜单）</label>
                <input
                  id={`nav-icon-${item.id}`}
                  className="admin-input"
                  value={item.icon}
                  maxLength={8}
                  placeholder="◆"
                  onChange={(event) => update(index, { icon: event.target.value })}
                />
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={item.visible}
                disabled={lastVisible}
                onChange={(event) => update(index, { visible: event.target.checked })}
              />
              <span>
                在导航栏显示
                {lastVisible ? "（至少要留一项显示）" : ""}
              </span>
            </label>
          </section>
        );
      })}

      <button
        type="button"
        className="settings-add-btn"
        disabled={value.length >= MAX_NAV_ITEMS}
        onClick={() => onChange([...value, createCustomNavItem(newItemId())])}
      >
        {value.length >= MAX_NAV_ITEMS ? `最多 ${MAX_NAV_ITEMS} 项` : "+ 添加导航项"}
      </button>
      <button className="admin-button" disabled={saving || visibleCount === 0} onClick={() => onSave(value)}>
        {saving ? "保存中..." : "保存导航栏"}
      </button>
    </div>
  );
}
