import Link from "next/link";
import type { Tool } from "@/lib/tools";
import { ICONS } from "@/components/icon-map";
import { IconChevronRight, IconPlus } from "@/components/icons";

type SoonTool = { name: string; hint: string };

export function HomeConsole({
  tools,
  soonTools,
}: {
  tools: Tool[];
  soonTools: SoonTool[];
}) {
  // 仪表阵列按注册表 index 顺序展示
  const ordered = [...tools].sort((a, b) => a.index.localeCompare(b.index));

  return (
    <>
      <div className="section-label label">仪表阵列</div>

      <div className="console">
        {ordered.map((t) => (
          <Link key={t.id} href={t.path} className="module">
            <div className="module-head">
              <span className="label">
                <span className={`lamp ${t.lamp}`} aria-hidden="true" />
                {t.index}
              </span>
              <span className="right label">就绪</span>
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
        ))}
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
