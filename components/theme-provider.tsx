"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getTheme(): Theme {
  return typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function apply(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("toolbox-theme", next);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const toggle = useCallback(() => {
    apply(theme === "dark" ? "light" : "dark");
  }, [theme]);
  return { theme, toggle };
}
