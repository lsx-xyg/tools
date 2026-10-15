"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GITHUB_REPO, tools } from "@/lib/tools";
import { ICONS } from "@/components/icon-map";
import { IconHome, IconPlus } from "@/components/icons";

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

function isActive(pathname: string, path: string) {
  return pathname.startsWith(path);
}

/* ---------- 桌面端：侧边栏平铺全部工具 ---------- */

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <div className="nav-groups">
      <div>
        <div className="nav-group-label label">工具</div>
        <div className="nav-items">
          <Link
            href="/"
            className={`nav-item ${pathname === "/" ? "active" : ""}`}
            title="仪表台"
          >
            <IconHome className="nav-icon" />
            <span className="nav-text">仪表台</span>
          </Link>
          {[...tools]
            .sort((a, b) => a.index.localeCompare(b.index))
            .map((t) => (
              <Link
                key={t.id}
                href={t.path}
                className={`nav-item ${isActive(pathname, t.path) ? "active" : ""}`}
                title={t.name}
              >
                {ICONS[t.icon]?.({ width: 18, height: 18 })}
                <span className="nav-text">{t.name}</span>
                {t.lamp && <span className={`lamp ${t.lamp}`} aria-hidden="true" />}
              </Link>
            ))}
        </div>
      </div>
      <SoonBlock />
    </div>
  );
}

/* ---------- 移动端抽屉：平铺全部工具 ---------- */

export function MobileDrawerNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
        {[...tools]
          .sort((a, b) => a.index.localeCompare(b.index))
          .map((t) => (
            <Link
              key={t.id}
              href={t.path}
              className={`nav-item ${isActive(pathname, t.path) ? "active" : ""}`}
              onClick={onNavigate}
              title={t.name}
            >
              {ICONS[t.icon]?.({ width: 18, height: 18 })}
              <span className="nav-text">{t.name}</span>
              {t.lamp && <span className={`lamp ${t.lamp}`} aria-hidden="true" />}
            </Link>
          ))}
      </div>
      <SoonBlock />
    </div>
  );
}
