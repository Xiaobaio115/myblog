"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "blue" | "light";

const CYCLE: Theme[] = ["light", "dark", "blue"];

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("luna-theme") as Theme | null;
    return stored && CYCLE.includes(stored) ? stored : "light";
  });

  function apply(t: Theme) {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem("luna-theme", t);
    apply(t);
  }

  function toggle() {
    const idx = CYCLE.indexOf(theme);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
