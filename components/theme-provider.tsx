"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * 三态主题：跟随系统（system）/ 浅色 / 深色。
 * - 偏好持久化在 localStorage["toolbox-theme"] = "system" | "light" | "dark"
 * - system 时实时监听系统主题变化（matchMedia change）
 * - 跨标签页同步（storage 事件）
 * - 实际生效值 resolved = system ? 系统偏好 : 偏好
 */
export type ThemePref = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const PREF_KEY = "toolbox-theme";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

const ThemeContext = createContext<{
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (p: ThemePref) => void;
  cycle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => (typeof window === "undefined" ? "system" : readPref()));
  const [system, setSystem] = useState<ResolvedTheme>(() => (typeof window === "undefined" ? "light" : systemTheme()));

  const resolved: ResolvedTheme = pref === "system" ? system : pref;

  // 应用 resolved 到 <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  // 跟随系统：监听系统主题变化（仅 system 模式生效）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREF_KEY) {
        setPrefState((e.newValue === "light" || e.newValue === "dark") ? e.newValue : "system");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(PREF_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const cycle = useCallback(() => {
    setPrefState((p) => {
      const next: ThemePref = p === "system" ? "light" : p === "light" ? "dark" : "system";
      try {
        localStorage.setItem(PREF_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref, cycle }), [pref, resolved, setPref]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 兜底：未包裹 Provider 时提供只读默认，避免崩溃
    return { pref: "system" as ThemePref, resolved: "light" as ResolvedTheme, setPref: () => {}, cycle: () => {} };
  }
  return ctx;
}
