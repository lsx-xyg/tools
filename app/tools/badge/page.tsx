"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import hljs from "highlight.js";
import { ColorPicker } from "@/components/color-picker";

const STYLES = ["flat", "plastic", "flat-square", "for-the-badge", "social"] as const;
type BadgeStyle = (typeof STYLES)[number];

const OUTPUT_MODES = ["Markdown", "HTML", "直链"] as const;
type OutputMode = (typeof OUTPUT_MODES)[number];

function enc(v: string) {
  return encodeURIComponent(v);
}

export default function BadgePage() {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("message");
  const [color, setColor] = useState("#007ec6");
  const [style, setStyle] = useState<BadgeStyle>("flat");
  const [logo, setLogo] = useState("");
  const [logoColor, setLogoColor] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("Markdown");
  const [copied, setCopied] = useState(false);

  const badgeUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (label) params.set("label", label);
    params.set("message", message || "message");
    params.set("color", color.replace(/^#/, ""));
    params.set("style", style);
    if (logo) params.set("logo", logo);
    if (logoColor) params.set("logoColor", logoColor.replace(/^#/, ""));
    return `https://img.shields.io/static/v1?${params.toString()}`;
  }, [label, message, color, style, logo, logoColor]);

  const altText = label ? `${label}: ${message}` : message;

  const code = useMemo(() => {
    if (outputMode === "Markdown") return `![${altText}](${badgeUrl})`;
    if (outputMode === "HTML") return `<img alt="${altText}" src="${badgeUrl}" />`;
    return badgeUrl;
  }, [outputMode, altText, badgeUrl]);

  const highlighted = useMemo(() => {
    const lang = outputMode === "HTML" ? "xml" : outputMode === "直链" ? "bash" : "markdown";
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      return code;
    }
  }, [code, outputMode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">徽章生成器</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          基于 shields.io 在线渲染 · 配置左侧参数，右侧实时预览并复制代码
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* ========== 左栏：配置 ========== */}
        <div className="panel" style={{ overflow: "visible" }}>
          <div className="panel-head">
            <span>配置</span>
          </div>
          <div className="space-y-5 p-5">
            {/* Label + Message */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Label（可选）</label>
                <input
                  className="input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="如 build"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <input
                  className="input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="如 passing"
                />
              </div>
            </div>

            {/* 颜色 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">颜色</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* 样式 + Logo 颜色 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">样式</label>
                <div className="seg flex-wrap">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-active={style === s}
                      onClick={() => setStyle(s)}
                      className="!px-2.5 !text-[11px]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Logo 颜色（可选）</label>
                <input
                  className="input font-mono"
                  value={logoColor}
                  onChange={(e) => setLogoColor(e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Logo（可选，Simple Icons 名称）
              </label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="如 github / docker / react"
                />
                <a
                  href="https://simpleicons.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  <ExternalLink width={14} height={14} />
                  全部图标
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 右栏：预览 + 代码 ========== */}
        <div className="min-w-0 space-y-6">
          {/* 预览 */}
          <div className="panel">
            <div className="panel-head">
              <span>预览</span>
            </div>
            <div className="flex min-h-[140px] items-center justify-center bg-[repeating-conic-gradient(var(--bg-subtle)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-8">
              <img
                src={badgeUrl}
                alt={altText}
                className="max-w-full"
                style={{ imageRendering: "auto" }}
              />
            </div>
          </div>

          {/* 代码输出 */}
          <div className="panel overflow-hidden">
            <div className="panel-head flex items-center justify-between">
              <span>代码输出</span>
              <div className="seg">
                {OUTPUT_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-active={outputMode === m}
                    onClick={() => setOutputMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={copy}
                className="absolute right-3 top-3 z-10 flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                {copied ? (
                  <>
                    <Check width={13} height={13} className="text-emerald-400" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy width={13} height={13} />
                    复制
                  </>
                )}
              </button>
              <pre className="code-dark m-0 min-h-[120px] min-w-0 overflow-x-auto bg-slate-900 p-4 pr-20 text-[13px] leading-relaxed">
                <code
                  className="hljs language-xml whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70">
            徽章由{" "}
            <a
              href="https://shields.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              shields.io
            </a>{" "}
            在线渲染，Logo 图标来自{" "}
            <a
              href="https://simpleicons.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              Simple Icons
            </a>
            。
          </p>
        </div>
      </div>
    </div>
  );
}
