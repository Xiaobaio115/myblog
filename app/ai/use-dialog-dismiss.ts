"use client";

import { useEffect } from "react";

/**
 * 弹窗的 Esc 关闭。
 *
 * 声明了 aria-modal 就必须能用键盘退出，否则只用键盘的人被困在弹窗里。
 * 用 capture 阶段绑定：页面上还有别处监听 Escape（侧栏），
 * 不抢先处理的话会出现「关弹窗顺手把侧栏也关了」。
 */
export function useDialogDismiss(onDismiss: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onDismiss]);
}
