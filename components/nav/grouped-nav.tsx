"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GITHUB_REPO, tools, NAV_CATEGORIES, toolCategory } from "@/lib/tools";
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

/** 按分类分组的工具列表：组内按 index 排序，空组不渲染 */
function groupedTools() {
  const byIndex = [...tools].sort((a, b) => a.index.localeCompare(b.index));
  return NAV_CATEGORIES.map((category) => ({
    category,
    tools: byIndex.filter((t) => toolCategory(t) === category.id),
  })).filter((g) => g.tools.length > 0);
}

function ToolLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: { id: string; name: string; path: string; icon: string; lamp: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="nav-items">
      {items.map((t) => (
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
  );
}

/* ---------- 桌面端：侧边栏按分类分组平铺（同类工具集中） ---------- */

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
        </div>
      </div>

      {groupedTools().map(({ category, tools: items }) => (
        <div key={category.id} style={{ marginTop: 10 }}>
          <div
            className="nav-group-label label"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span>{category.name}</span>
            <span className="nav-count">{items.length}</span>
          </div>
          <ToolLinks items={items} pathname={pathname} />
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        <SoonBlock />
      </div>
    </div>
  );
}

/* ---------- 移动端抽屉：同样按分类分组平铺 ---------- */

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
      </div>

      {groupedTools().map(({ category, tools: items }) => (
        <div key={category.id} style={{ marginTop: 10 }}>
          <div
            className="nav-group-label label"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span>{category.name}</span>
            <span className="nav-count">{items.length}</span>
          </div>
          <ToolLinks items={items} pathname={pathname} onNavigate={onNavigate} />
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        <SoonBlock />
      </div>
    </div>
  );
}
