import Link from "next/link";
import { GITHUB_REPO, soonTools, tools } from "@/lib/tools";
import { StorageSwitch } from "@/components/storage-switch";
import {
  IconBase64,
  IconBolt,
  IconChevronRight,
  IconClock,
  IconCron,
  IconJson,
  IconPlus,
  IconQr,
  IconServer,
  IconShield,
  IconTransfer,
} from "@/components/icons";

const MODULE_ICONS: Record<string, (p: { width?: number; height?: number }) => React.ReactNode> = {
  transfer: IconTransfer,
  qr: IconQr,
  base64: IconBase64,
  json: IconJson,
  cron: IconCron,
};

export default function Home() {
  return (
    <div className="fade-rise">
      <header className="page-head">
        <h1>顺手的小工具，即开即用。</h1>
        <p className="lede">
          无需注册登录，打开就能用：跨设备互传、二维码生成、Base64 编码、JSON 格式化、Cron
          解析——全部本地处理或到期自动销毁。
        </p>
        <div className="meta-chips">
          <span className="chip accent">
            <IconBolt width={12} height={12} />
            在线 P2P 直传
          </span>
          <span className="chip">
            <IconServer width={12} height={12} />
            24h 自动清除
          </span>
          <span className="chip">
            <IconClock width={12} height={12} />
            免登录 · 免费
          </span>
          <span className="chip">
            <IconShield width={12} height={12} />
            内容到期即焚
          </span>
        </div>
      </header>

      <div className="section-label label">仪表阵列</div>
      <div className="console">
        {tools.map((t) => (
          <Link key={t.id} href={t.path} className="module">
            <div className="module-head">
              <span className="label">
                <span className={`lamp ${t.lamp}`} aria-hidden="true" />
                {t.index}
              </span>
              <span className="right label">就绪</span>
            </div>
            <div className="module-body">
              <div className="module-icon">{MODULE_ICONS[t.icon]?.({ width: 24, height: 24 })}</div>
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

      <StorageSwitch />

      <footer className="footer-strip">
        <span>
          工具箱 TOOLBOX · 开源在{" "}
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
        <span>数据 24 小时后自动销毁</span>
        <span>由 Cloudflare Workers 驱动</span>
      </footer>
    </div>
  );
}
