"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("luna-theme") as Theme | null;
    apply(stored ?? "dark");
  }, []);

  function apply(t: Theme) {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("luna-theme", next);
    apply(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
