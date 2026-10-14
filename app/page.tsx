import { GITHUB_REPO, soonTools, tools } from "@/lib/tools";
import { StorageSwitch } from "@/components/storage-switch";
import { HomeConsole } from "@/components/home-console";
import {
  IconBolt,
  IconClock,
  IconServer,
  IconShield,
} from "@/components/icons";

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
            到期自动清除
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

      <HomeConsole tools={tools} soonTools={soonTools} />

      <StorageSwitch />

      <footer className="footer-strip">
        <span>
          工具箱 TOOLBOX · 开源在{" "}
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
        <span>数据到期自动销毁</span>
        <span>由 Cloudflare Workers 驱动</span>
      </footer>
    </div>
  );
}
