"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GITHUB_REPO, groupedTools, type Tool } from "@/lib/tools";
import { ICONS } from "@/components/icon-map";
import { IconChevronRight, IconHome, IconPlus } from "@/components/icons";

const groups = groupedTools();

function isActive(pathname: string, t: Tool) {
  return pathname.startsWith(t.path);
}

/** 「更多工具筹备中」块（桌面 / 移动共用） */
function SoonBlock() {
  return (
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
  );
}

/* ---------- 桌面端：大菜单 + 悬浮浮层（仅 >1023px 显示） ---------- */

function DesktopGroup({ group }: { group: (typeof groups)[number] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const catActive = group.tools.some((t) => isActive(pathname, t));

  function cancelClose() {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  }

  function scheduleClose() {
    cancelClose();
    // 防闪烁：给鼠标从组头移向浮层留出 140ms 跨越空隙
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  function openFlyout() {
    cancelClose();
    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: Math.max(8, r.top - 6), left: r.right + 10 });
    }
    setOpen(true);
  }

  return (
    <div
      ref={wrapRef}
      className={`nav-group-wrap ${open ? "open" : ""} ${catActive ? "has-active" : ""}`}
      onMouseEnter={openFlyout}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`nav-item nav-group-head ${catActive ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openFlyout();
          }
        }}
        title={group.category.name}
      >
        {ICONS[group.category.icon]?.({ width: 18, height: 18 })}
        <span className="nav-text">{group.category.name}</span>
        <span className="nav-count" aria-hidden="true">
          {group.tools.length}
        </span>
      </button>

      {open && pos &&
        createPortal(
          <div
            className="nav-flyout"
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
          >
            <div className="nav-flyout-title label">{group.category.name}</div>
            {group.tools.map((t) => (
              <Link
                key={t.id}
                href={t.path}
                role="menuitem"
                className={`nav-item flyout-item ${isActive(pathname, t) ? "active" : ""}`}
                title={t.name}
              >
                {ICONS[t.icon]?.({ width: 16, height: 16 })}
                <span className="flyout-name">{t.name}</span>
                <span className={`lamp ${t.lamp}`} aria-hidden="true" />
              </Link>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <div className="nav-groups">
      <div>
        <div className="nav-group-label label">工具</div>
        <div className="nav-items nav-group-list">
          <Link
            href="/"
            className={`nav-item ${pathname === "/" ? "active" : ""}`}
            title="仪表台"
          >
            <IconHome className="nav-icon" />
            <span className="nav-text">仪表台</span>
          </Link>
          {groups.map((g) => (
            <DesktopGroup key={g.category.id} group={g} />
          ))}
        </div>
      </div>
      <SoonBlock />
    </div>
  );
}

/* ---------- 移动端抽屉：手风琴折叠列表（无 hover） ---------- */

function MobileDrawerNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // 默认展开「包含当前页面」的组；路由变化时自动展开当前组
  const activeGroupId =
    groups.find((g) => g.tools.some((t) => isActive(pathname, t)))?.category.id ?? groups[0]?.category.id;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(activeGroupId ? [activeGroupId] : []),
  );

  useEffect(() => {
    if (activeGroupId) {
      setExpanded((s) => (s.has(activeGroupId) ? s : new Set(s).add(activeGroupId)));
    }
  }, [activeGroupId]);

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="nav-groups drawer-nav">
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
        {groups.map((g) => {
          const catActive = g.tools.some((t) => isActive(pathname, t));
          const isOpen = expanded.has(g.category.id);
          return (
            <div key={g.category.id} className="drawer-group">
              <button
                type="button"
                className={`nav-item drawer-group-head ${catActive ? "has-active" : ""}`}
                aria-expanded={isOpen}
                onClick={() => toggle(g.category.id)}
              >
                {ICONS[g.category.icon]?.({ width: 18, height: 18 })}
                <span className="nav-text">{g.category.name}</span>
                <span className="nav-count" aria-hidden="true">
                  {g.tools.length}
                </span>
                <IconChevronRight
                  width={14}
                  height={14}
                  className={`drawer-group-chev ${isOpen ? "open" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="drawer-group-items">
                  {g.tools.map((t) => (
                    <Link
                      key={t.id}
                      href={t.path}
                      className={`nav-item drawer-item ${isActive(pathname, t) ? "active" : ""}`}
                      onClick={onNavigate}
                      title={t.name}
                    >
                      {ICONS[t.icon]?.({ width: 16, height: 16 })}
                      <span className="nav-text">{t.name}</span>
                      <span className={`lamp ${t.lamp}`} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SoonBlock />
    </div>
  );
}

export { MobileDrawerNav };
