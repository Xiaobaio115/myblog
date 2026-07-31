"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "luna-theme";
const THEME_CHANGE_EVENT = "luna-theme-change";
let transitionTimer = 0;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

function applyTheme(theme: Theme, animate = false) {
  if (animate) {
    document.documentElement.classList.add("theme-switching");
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-switching");
    }, 320);
  }
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const next = event.newValue === "dark" ? "dark" : "light";
    applyTheme(next, true);
    onStoreChange();
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemTheme = () => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // Follow the system theme when storage is unavailable.
    }
    applyTheme(media.matches ? "dark" : "light", true);
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  media.addEventListener("change", handleSystemTheme);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
    media.removeEventListener("change", handleSystemTheme);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readTheme, () => "light");

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next, true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The visible theme should still change when storage is blocked.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
