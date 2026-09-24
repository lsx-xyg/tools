"use client";

import { useEffect, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconMonitor, IconShield } from "@/components/icons";

interface DeviceInfo {
  label: string;
  value: string;
}

function collect(): DeviceInfo[] {
  const nav = navigator;
  const ua = nav.userAgent;
  const screen = screenSize();
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "其他";
  return [
    { label: "浏览器", value: `${browser} · ${ua.split(`${browser}/`)[1]?.split(" ")[0] ?? ua}` },
    { label: "屏幕尺寸", value: `${screen.width} × ${screen.height} px` },
    { label: "逻辑视口", value: `${window.innerWidth} × ${window.innerHeight} px` },
    { label: "像素密度", value: `${window.devicePixelRatio.toFixed(2)} DPR` },
    { label: "CSS 像素", value: `${Math.round(screen.width / window.devicePixelRatio)} × ${Math.round(screen.height / window.devicePixelRatio)}` },
    { label: "颜色深度", value: `${window.screen.colorDepth ?? "—"} bit` },
    { label: "操作系统", value: osName(ua) },
    { label: "设备类型", value: isMobile(ua) ? "移动端" : "桌面端" },
    { label: "语言", value: nav.language ?? "—" },
    { label: "时区", value: `${Intl.DateTimeFormat().resolvedOptions().timeZone ?? "—"} · UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? "+" : ""}${-new Date().getTimezoneOffset() / 60}` },
    { label: "在线状态", value: nav.onLine ? "在线" : "离线" },
    { label: "CPU 核数", value: `${nav.hardwareConcurrency ?? "—"} 核` },
    ...(("deviceMemory" in nav ? (nav as unknown as { deviceMemory: number }).deviceMemory : 0)
      ? [{ label: "内存", value: `${(nav as unknown as { deviceMemory: number }).deviceMemory} GB` }]
      : []),
    { label: "Cookie 可用", value: nav.cookieEnabled ? "是" : "否" },
  ];
}

function screenSize() {
  const d = window.screen;
  return { width: d.width, height: d.height };
}

function osName(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10 / 11";
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "未知";
}

function isMobile(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad/.test(ua);
}

export default function DeviceInfoPage() {
  const [info, setInfo] = useState<DeviceInfo[]>([]);
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setInfo(collect());
      const s = screenSize();
      setSummary(`${s.width}×${s.height} · ${window.devicePixelRatio.toFixed(2)} DPR · ${osName(navigator.userAgent)}`);
    };
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(
        info.map((i) => `${i.label}: ${i.value}`).join("\n"),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="设备信息"
        lede="屏幕、系统、浏览器、网络等环境信息"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地读取 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="tool-row">
          <span className="count-hint" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconMonitor width={14} height={14} />
            {summary}
          </span>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => void copyAll()} type="button">
            {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
            {copied ? "已复制" : "复制全部"}
          </button>
        </div>
        <div className="kv-list">
          {info.map((i) => (
            <div className="kv-row" key={i.label}>
              <span className="kv-key">{i.label}</span>
              <span className="kv-val mono">{i.value}</span>
            </div>
          ))}
        </div>
        <p className="count-hint" style={{ marginTop: 10 }}>窗口尺寸变化、网络状态变化时自动刷新</p>
      </div>
    </div>
  );
}
