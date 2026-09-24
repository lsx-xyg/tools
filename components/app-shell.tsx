"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { tools, GITHUB_REPO } from "@/lib/tools";
import { Brand } from "./brand";
import { useTheme } from "./theme-provider";
import {
  IconGithub,
  IconHome,
  IconMenu,
  IconMoon,
  IconSun,
  IconTransfer,
  IconX,
} from "./icons";

const ICONS: Record<string, (p: { width?: number; height?: number }) => React.ReactNode> = {
  transfer: IconTransfer,
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
            >
              <IconHome className="nav-icon" />
              仪表台
            </Link>
            {tools.map((t) => (
              <Link
                key={t.id}
                href={t.path}
                className={`nav-item ${pathname.startsWith(t.path) ? "active" : ""}`}
                onClick={onNavigate}
              >
                {ICONS[t.icon]?.({ width: 18, height: 18 })}
                {t.name}
                <span className={`lamp ${t.lamp}`} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="nav-group-label label">更多</div>
          <div className="nav-items">
            <span className="nav-item soon" aria-disabled="true">
              更多工具筹备中
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
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={theme === "dark" ? "浅色模式" : "深色模式"}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" aria-label="返回仪表台">
          <Brand />
        </Link>
        <NavContent />
        <div className="sidebar-foot">
          <div className="row">
            <span>主题</span>
            <ThemeButton />
          </div>
          <div className="row">
            <a href={GITHUB_REPO} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconGithub width={15} height={15} />
              开源在 GitHub
            </a>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={() => setOpen(true)}
            aria-label="打开菜单"
            aria-expanded={open}
          >
            <IconMenu />
          </button>
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
    </div>
  );
}
