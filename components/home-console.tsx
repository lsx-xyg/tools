"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Tool } from "@/lib/tools";
import { ICONS } from "@/components/icon-map";
import {
  IconChevronRight,
  IconPlus,
  IconSliders,
  IconStar,
  IconTrash,
  IconX,
} from "@/components/icons";

const USAGE_KEY = "toolbox.usage";
const PINNED_KEY = "toolbox.pinned";

type Usage = Record<string, number>;

type SoonTool = { name: string; hint: string };

function readUsage(): Usage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Usage) : {};
  } catch {
    return {};
  }
}

function readPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function HomeConsole({
  tools,
  soonTools,
}: {
  tools: Tool[];
  soonTools: SoonTool[];
}) {
  // 首帧必须与服务端渲染一致：先按 index 排序，挂载后再读 localStorage 重排（避免 hydration mismatch）
  const [ready, setReady] = useState(false);
  const [usage, setUsage] = useState<Usage>({});
  const [pinned, setPinned] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    setUsage(readUsage());
    setPinned(readPinned());
    setReady(true);
  }, []);

  // 排序：置顶（按置顶顺序）→ 点击次数多者前 → 其余按 index；soonTools 恒在末尾
  const ordered = useMemo(() => {
    const byIndex = [...tools].sort((a, b) => a.index.localeCompare(b.index));
    if (!ready) return byIndex;
    const pinnedSet = new Set(pinned);
    const pinnedTools = pinned
      .map((id) => tools.find((t) => t.id === id))
      .filter((t): t is Tool => Boolean(t));
    const rest = byIndex.filter((t) => !pinnedSet.has(t.id));
    rest.sort(
      (a, b) =>
        (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.index.localeCompare(b.index)
    );
    return [...pinnedTools, ...rest];
  }, [tools, ready, usage, pinned]);

  // 管理面板里的顺序：置顶 → 点击次数 → index
  const managed = useMemo(() => {
    const byIndex = [...tools].sort((a, b) => a.index.localeCompare(b.index));
    const pinnedSet = new Set(pinned);
    const pinnedTools = pinned
      .map((id) => tools.find((t) => t.id === id))
      .filter((t): t is Tool => Boolean(t));
    const rest = byIndex.filter((t) => !pinnedSet.has(t.id));
    rest.sort(
      (a, b) =>
        (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.index.localeCompare(b.index)
    );
    return [...pinnedTools, ...rest];
  }, [tools, usage, pinned]);

  function bumpUsage(id: string) {
    // 每次都先读 localStorage 再合并写，避免 effect 未就绪时覆盖已有数据
    const stored = readUsage();
    stored[id] = (stored[id] ?? 0) + 1;
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(stored));
    } catch {
      /* 隐私模式等场景下静默失败 */
    }
    setUsage(stored);
  }

  function togglePin(id: string) {
    const next = pinned.includes(id)
      ? pinned.filter((x) => x !== id)
      : [...pinned, id];
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setPinned(next);
  }

  function clearUsage() {
    try {
      localStorage.removeItem(USAGE_KEY);
    } catch {
      /* ignore */
    }
    setUsage({});
  }

  const totalClicks = Object.values(usage).reduce((s, n) => s + (n || 0), 0);
  const hasSortHint = ready && (pinned.length > 0 || totalClicks > 0);

  return (
    <>
      <div className="section-label label">
        仪表阵列
        <button
          type="button"
          className={`btn btn-sm ${panelOpen ? "btn-primary" : "btn-ghost"}`}
          style={{ marginLeft: "auto", minHeight: 36 }}
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
        >
          <IconSliders width={14} height={14} />
          常用管理
          {panelOpen ? <IconX width={14} height={14} /> : null}
        </button>
      </div>

      {hasSortHint && (
        <p className="count-hint" style={{ margin: "-4px 0 12px" }}>
          已置顶 {pinned.length} 个 · 共记录 {totalClicks} 次点击，按常用程度排序
        </p>
      )}

      {panelOpen && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <span className="label">
              <IconStar width={12} height={12} />
              常用工具管理
            </span>
            <span className="right">
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                onClick={clearUsage}
                disabled={totalClicks === 0}
              >
                <IconTrash width={13} height={13} />
                清空计数
              </button>
            </span>
          </div>
          <div className="panel-body" style={{ gap: 4, paddingTop: 8, paddingBottom: 8 }}>
            {managed.map((t) => {
              const isPinned = pinned.includes(t.id);
              const count = usage[t.id] ?? 0;
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 44,
                    padding: "6px 2px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => togglePin(t.id)}
                    aria-pressed={isPinned}
                    title={isPinned ? "取消置顶" : "置顶到最前"}
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${isPinned ? "var(--line-strong)" : "var(--line)"}`,
                      background: isPinned ? "var(--accent-soft)" : "transparent",
                      color: isPinned ? "var(--accent)" : "var(--ink-3)",
                    }}
                  >
                    <IconStar width={16} height={16} style={isPinned ? { fill: "currentColor" } : undefined} />
                  </button>
                  <span className="label" style={{ width: 44, flexShrink: 0 }}>
                    {t.index}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                  </span>
                  <span className="chip" style={{ flexShrink: 0 }}>
                    点击 {count}
                  </span>
                </div>
              );
            })}
            <p className="count-hint" style={{ marginTop: 10 }}>
              点星标置顶工具；首页模块点击会自动计数，排序即时生效，数据仅保存在本机浏览器。
            </p>
          </div>
        </div>
      )}

      <div className="console">
        {ordered.map((t) => {
          const isPinned = pinned.includes(t.id);
          const count = usage[t.id] ?? 0;
          return (
            <Link key={t.id} href={t.path} className="module" onClick={() => bumpUsage(t.id)}>
              <div className="module-head">
                <span className="label">
                  <span className={`lamp ${t.lamp}`} aria-hidden="true" />
                  {t.index}
                </span>
                <span className="right label">
                  {isPinned && (
                    <IconStar
                      width={12}
                      height={12}
                      style={{ color: "var(--lamp-amber)", fill: "var(--lamp-amber)" }}
                    />
                  )}
                  {ready && count > 0 && (
                    <span className="chip" style={{ padding: "2px 8px" }}>
                      ×{count}
                    </span>
                  )}
                  就绪
                </span>
              </div>
              <div className="module-body">
                <div className="module-icon">{ICONS[t.icon]?.({ width: 24, height: 24 })}</div>
                <div className="module-name">{t.name}</div>
                <div className="module-desc">{t.description}</div>
                <div className="module-tags">
                  {t.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="module-cta">
                  <span className="btn btn-primary btn-block">
                    打开仪表
                    <IconChevronRight width={15} height={15} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
        {soonTools.map((s, i) => (
          <div key={s.name} className="module soon" aria-disabled="true">
            <div className="module-head">
              <span className="label">
                <span className="lamp amber" aria-hidden="true" />
                T-0{tools.length + i + 1}
              </span>
              <span className="right label">筹备中</span>
            </div>
            <div className="module-body">
              <div className="module-icon">
                <IconPlus />
              </div>
              <div className="module-name">{s.name}</div>
              <div className="module-desc">{s.hint} · 欢迎到 GitHub 提想法</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
