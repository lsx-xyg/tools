"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { tools, GITHUB_REPO } from "@/lib/tools";
import { Brand } from "./brand";
import { useTheme } from "./theme-provider";
import { SearchPalette } from "./search-palette";
import { IconBase64, IconChevronsLeft, IconChevronsRight, IconClock, IconCron, IconDocText, IconFileCheck, IconFileDiff, IconFingerprint, IconGithub, IconHash, IconHome, IconJson, IconKey, IconLink, IconMenu, IconMoon, IconPlus, IconQr, IconRepeat, IconSearch, IconSun, IconTextSearch, IconTransfer, IconX } from "./icons";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, (p: { width?: number; height?: number }) => React.ReactNode> = {
  transfer: IconTransfer,
  qr: IconQr,
  base64: IconBase64,
  json: IconJson,
  cron: IconCron,
  convert: IconRepeat,
  ts: IconClock,
  hash: IconHash,
  uuid: IconFingerprint,
  diff: IconFileDiff,
  regex: IconTextSearch,
  text: IconDocText,
  url: IconLink,
  jwt: IconKey,
  "file-hash": IconFileCheck,
};

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="nav-groups">
        <div>
          <div className="nav-group-label label">工具</div>
          <div className="nav-items">
            <Link
              href="/"
              className={`nav-item ${pathname === "/" ? "active" : ""}`}
              onClick={onNavigate}
              title="仪表台"
            >
              <IconHome className="nav-icon" />
              <span className="nav-text">仪表台</span>
            </Link>
            {tools.map((t) => (
              <Link
                key={t.id}
                href={t.path}
                className={`nav-item ${pathname.startsWith(t.path) ? "active" : ""}`}
                onClick={onNavigate}
                title={t.name}
              >
                {ICONS[t.icon]?.({ width: 18, height: 18 })}
                <span className="nav-text">{t.name}</span>
                <span className={`lamp ${t.lamp}`} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="nav-group-label label">更多</div>
          <div className="nav-items">
            <span className="nav-item soon" aria-disabled="true" title="更多工具筹备中">
              <IconPlus className="nav-icon" />
              <span className="nav-text">更多工具筹备中</span>
              <span className="lamp amber" aria-hidden="true" />
            </span>
          </div>
          <p className="nav-soon-note">
            有想用的工具？
            <a href={`${GITHUB_REPO}/issues`} target="_blank" rel="noreferrer">
              来 GitHub 提想法
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={theme === "dark" ? "浅色模式" : "深色模式"}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("toolbox-sidebar") === "1",
  );

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("toolbox-sidebar", next ? "1" : "0");
      } catch {
        /* localStorage 不可用时忽略 */
      }
      return next;
    });
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <Link href="/" aria-label="返回仪表台">
            <Brand compact={collapsed} />
          </Link>
        </div>

        <div className="sidebar-search">
          <button
            className="search-trigger"
            onClick={() => window.dispatchEvent(new CustomEvent("toolbox:open-search"))}
            aria-label="搜索工具"
            title="搜索工具（Ctrl K）"
          >
            <IconSearch className="nav-icon" width={18} height={18} />
            <span className="nav-text">搜索工具…</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>

        <NavContent />

        <div className="sidebar-foot">
          <div className="row">
            <span className="nav-text">主题</span>
            <ThemeButton />
          </div>
          <a
            className="nav-item github-link"
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            title="开源在 GitHub"
          >
            <IconGithub className="nav-icon" />
            <span className="nav-text">开源在 GitHub</span>
          </a>
          <div className="row">
            <button
              className="collapse-btn"
              onClick={toggleSidebar}
              aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              <span className="collapse-ic" aria-hidden="true">
                <IconChevronsLeft width={15} height={15} className="ic-expand" />
                <IconChevronsRight width={15} height={15} className="ic-collapse" />
              </span>
              <span className="nav-text">{collapsed ? "展开" : "收起侧边栏"}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              aria-label="打开菜单"
              aria-expanded={open}
            >
              <IconMenu />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.dispatchEvent(new CustomEvent("toolbox:open-search"))}
              aria-label="搜索工具"
              title="搜索工具（Ctrl K）"
            >
              <IconSearch />
            </Button>
          </div>
          <Link href="/" aria-label="返回仪表台">
            <Brand compact />
          </Link>
          <ThemeButton />
        </header>
        <main id="main" className="main-inner">
          {children}
        </main>
      </div>

      <div
        className={`drawer-scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <nav className={`drawer ${open ? "open" : ""}`} aria-label="站点菜单">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Brand compact />
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭菜单">
            <IconX />
          </button>
        </div>
        <NavContent onNavigate={() => setOpen(false)} />
        <div className="sidebar-foot">
          <div className="row">
            <span>主题</span>
            <ThemeButton />
          </div>
        </div>
      </nav>

      <SearchPalette />
    </div>
  );
}
