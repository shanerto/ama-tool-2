"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type PresenterTheme = "dark" | "light";

interface ThemeContextValue {
  theme: PresenterTheme;
  setTheme: (t: PresenterTheme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<PresenterTheme>("dark");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePresenterTheme() {
  return useContext(ThemeContext);
}
