import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: { default: "工具箱 TOOLBOX · 在线小工具", template: "%s · 工具箱" },
  description:
    "在线工具箱：跨设备文本 / 文件互传等小工具，无需登录，内容到期自动销毁。在线直传不落服务器，离线暂存 24 小时自动清除。由 Cloudflare Workers 驱动。",
};

export const viewport: Viewport = {
  themeColor: "#f5f3ef",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("toolbox-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
