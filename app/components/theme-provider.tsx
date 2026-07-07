"use client";

import { createContext, useContext, useEffect } from "react";

export type Theme = "light";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    localStorage.setItem("luna-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  function setTheme() {
    localStorage.setItem("luna-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  }

  function toggle() {
    setTheme();
  }

  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
