"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { tools, soonTools } from "@/lib/tools";
import { IconSearch, IconHome } from "./icons";
import { ICONS } from "./icon-map";

const noopSubscribe = () => () => {};

interface Entry {
  key: string;
  name: string;
  hint: string;
  path?: string;
  soon?: boolean;
}

function buildIndex(): Entry[] {
  return [
    { key: "home", name: "仪表台", hint: "工具总览 · 首页", path: "/" },
    ...tools.map((t) => ({
      key: t.id,
      name: t.name,
      hint: `${t.tagline} · ${t.tags.join(" / ")}`,
      path: t.path,
    })),
    ...soonTools.map((s) => ({ key: `soon-${s.name}`, name: s.name, hint: `${s.hint} · 筹备中`, soon: true })),
  ];
}

function matchScore(entry: Entry, q: string): number {
  if (!q) return 1;
  const hay = `${entry.name} ${entry.hint}`.toLowerCase();
  const needle = q.toLowerCase();
  if (entry.name.toLowerCase() === needle) return 100;
  if (entry.name.toLowerCase().startsWith(needle)) return 80;
  if (entry.name.toLowerCase().includes(needle)) return 60;
  if (hay.includes(needle)) return 40;
  return 0;
}

/** 自包含搜索面板：按钮 dispatch toolbox:open-search / Ctrl K 呼出，Esc 关闭 */
export function SearchPalette() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setQ("");
    setActive(0);
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  // 全局呼出：Ctrl/Cmd + K 或自定义事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("toolbox:open-search", openSearch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("toolbox:open-search", openSearch);
    };
  }, [openSearch]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const all = buildIndex();
    return all
      .map((e) => ({ e, score: matchScore(e, q.trim()) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [q]);

  // 面板内键盘：↑ ↓ Enter Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        const hit = results[active];
        if (hit?.e.path) {
          closeSearch();
          router.push(hit.e.path);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, router, closeSearch]);

  if (!isClient || !open) return null;

  const node = (
    <div className="palette-scrim" onClick={closeSearch}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="搜索工具"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-input">
          <IconSearch width={16} height={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="搜索工具：如「二维码」「JSON」「互传」…"
            aria-label="搜索工具"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list">
          {results.length === 0 && (
            <li className="palette-empty">
              没有匹配「{q}」的工具，欢迎到 GitHub 提想法
            </li>
          )}
          {results.map(({ e }, i) => {
            const Tag = e.key === "home" ? IconHome : ICONS[e.key];
            return (
              <li key={e.key}>
                <button
                  className={`palette-item ${i === active ? "active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    if (e.path) {
                      closeSearch();
                      router.push(e.path);
                    }
                  }}
                  type="button"
                >
                  <span className="palette-ic">{!e.soon && Tag ? <Tag width={16} height={16} /> : null}</span>
                  <span className="palette-name">{e.name}</span>
                  <span className="palette-hint">{e.hint}</span>
                  {e.soon && <span className="lamp amber" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="palette-foot">
          <kbd>↑</kbd> <kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 打开 · <kbd>Ctrl K</kbd> 随时呼出
        </p>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
