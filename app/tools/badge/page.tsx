"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconSearch, IconShield, IconX } from "@/components/icons";

const STYLES = [
  "flat",
  "flat-square",
  "plastic",
  "for-the-badge",
  "social",
  "popout",
  "popout-square",
];

/** shields.io 命名色 → hex */
const NAMED: Record<string, string> = {
  brightgreen: "4c1",
  green: "97ca00",
  yellowgreen: "a4a61d",
  yellow: "dfb317",
  orange: "fe7d37",
  red: "e05d44",
  blue: "007ec6",
  lightgrey: "9f9f9f",
  blueviolet: "8c8ce0",
  pink: "dd5597",
  darkgrey: "555",
  white: "fff",
  black: "333",
};

const COLORS: { name: string; hex: string }[] = [
  { name: "brightgreen", hex: "4c1" },
  { name: "green", hex: "97ca00" },
  { name: "yellowgreen", hex: "a4a61d" },
  { name: "yellow", hex: "dfb317" },
  { name: "orange", hex: "fe7d37" },
  { name: "red", hex: "e05d44" },
  { name: "blue", hex: "007ec6" },
  { name: "lightgrey", hex: "9f9f9f" },
  { name: "blueviolet", hex: "8c8ce0" },
  { name: "pink", hex: "dd5597" },
  { name: "darkgrey", hex: "555" },
  { name: "white", hex: "fff" },
  { name: "black", hex: "333" },
];

type OutKind = "markdown" | "html" | "link";
type SourceKind = "local" | "shields";

interface IconMeta {
  key: string;
  slug: string;
  title: string;
  hex: string;
}

/** 粗略估算 Verdana 11px 文本宽度（用于徽章 SVG 布局） */
function textWidth(s: string, bold: boolean): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x4e00 && c <= 0x9fff) w += 11.5;
    else if (c >= 48 && c <= 57) w += bold ? 7.8 : 7.2;
    else if (c >= 65 && c <= 90) w += bold ? 8.2 : 7.5;
    else if (c === 32) w += 3.6;
    else w += bold ? 6.8 : 6.2;
  }
  return w;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 本地生成 shields 风格徽章 SVG */
function renderBadgeSvg(
  label: string,
  message: string,
  colorRaw: string,
  style: string,
  iconPath?: string | null,
  logoColorRaw?: string
): string {
  const color = /^[0-9a-fA-F]{3,6}$/.test(colorRaw.replace(/^#/, ""))
    ? `#${colorRaw.replace(/^#/, "")}`
    : NAMED[colorRaw] ? `#${NAMED[colorRaw]}` : "#007ec6";
  const lc = (logoColorRaw ?? "").replace(/^#/, "");
  const logoColor = /^[0-9a-fA-F]{3,6}$/.test(lc) ? `#${lc}` : "white";

  const ftb = style === "for-the-badge";
  const l = ftb ? label.toUpperCase() : label;
  const m = ftb ? message.toUpperCase() : message;
  const bold = ftb;
  const pad = ftb ? 18 : 5;
  const fontSize = ftb ? 11.5 : 11;

  const iconW = iconPath ? 14 : 0;
  const labelW = Math.round(iconW + (l ? textWidth(l, bold) + pad * 2 : 0));
  const msgW = Math.round(textWidth(m || "message", bold) + pad * 2 + (m ? 0 : 10));
  const totalW = Math.max(20, labelW + msgW);

  const rx = style.includes("square") ? 0 : 3;
  const labelFill = style === "social" ? "#3b82f6" : "#555";
  const msgFill = color;
  const msgTx = m || "message";

  const grad = style === "plastic"
    ? `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.2" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>`
    : "";

  const labelRect = labelW > 0
    ? `<rect width="${labelW}" height="20" fill="${labelFill}" rx="${rx}"/><rect x="${labelW - 3}" width="3" height="20" fill="${labelFill}"/>`
    : "";
  const msgRect = `<rect x="${labelW}" width="${msgW}" height="20" fill="${msgFill}" rx="${rx}"/>${labelW > 0 ? `<rect x="${labelW}" width="3" height="20" fill="${labelFill}"/>` : ""}`;
  const fill = grad ? "url(#g)" : "#fff";

  const icon = iconPath
    ? `<g fill="${logoColor}"><path transform="translate(${Math.round((iconW - 14) / 2)},3)" d="${iconPath}" width="14" height="14"/></g>`
    : "";
  const labelText = labelW > 0
    ? `<text x="${Math.round(labelW / 2)}" y="14" fill="${fill}" font-family="Verdana, Geneva, sans-serif" font-size="${fontSize}" text-anchor="middle"${bold ? ' font-weight="bold"' : ""}>${escXml(l)}</text>`
    : "";
  const msgText = `<text x="${Math.round(labelW + msgW / 2)}" y="14" fill="${fill}" font-family="Verdana, Geneva, sans-serif" font-size="${fontSize}" text-anchor="middle"${bold ? ' font-weight="bold"' : ""}>${escXml(msgTx)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="20" role="img" aria-label="${escXml(label || "label")}: ${escXml(msgTx)}"><title>${escXml(label || "label")}: ${escXml(msgTx)}</title>${grad}${labelRect}${msgRect}${icon}${labelText}${msgText}</svg>`;
}

/** SVG → 可直接内嵌的 data URI */
function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

export default function BadgePage() {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("blue");
  const [style, setStyle] = useState("flat");
  const [logo, setLogo] = useState("");
  const [logoColor, setLogoColor] = useState("");
  const [outKind, setOutKind] = useState<OutKind>("markdown");
  const [source, setSource] = useState<SourceKind>("local");
  const [copied, setCopied] = useState(false);

  // ---- 图标库 ----
  const [iconIndex, setIconIndex] = useState<IconMeta[] | null>(null);
  const [iconQuery, setIconQuery] = useState("");
  const [iconOpen, setIconOpen] = useState(false);
  const [iconPath, setIconPath] = useState<string | null>(null);
  const iconBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/si-icons.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIconIndex(d))
      .catch(() => setIconIndex([]));
  }, []);

  const iconMatches = useMemo(() => {
    if (!iconIndex) return [];
    const q = iconQuery.trim().toLowerCase();
    if (!q) return iconIndex.slice(0, 18);
    return iconIndex
      .filter((i) => i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q))
      .slice(0, 24);
  }, [iconIndex, iconQuery]);

  const pickIcon = useCallback(async (meta: IconMeta) => {
    setLogo(meta.slug);
    setIconQuery("");
    setIconOpen(false);
    setIconPath(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("simple-icons");
      const icon = mod?.[meta.key] as { path?: string } | undefined;
      if (icon?.path) setIconPath(icon.path);
    } catch {
      /* 本地渲染失败时回退 shields.io */
    }
  }, []);

  // 点击外部关闭图标面板
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (iconBoxRef.current && !iconBoxRef.current.contains(e.target as Node)) setIconOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ---- 徽章渲染 ----
  const svg = useMemo(
    () => renderBadgeSvg(label, message, color, style, iconPath, logoColor),
    [label, message, color, style, iconPath, logoColor]
  );

  const shieldsUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (label) p.set("label", label);
    p.set("message", message || "message");
    if (color) p.set("color", color);
    p.set("style", style);
    if (logo) p.set("logo", logo);
    if (logoColor) p.set("logoColor", logoColor);
    return `https://img.shields.io/static/v1?${p.toString()}`;
  }, [label, message, color, style, logo, logoColor]);

  const output = useMemo(() => {
    const alt = `${label || "label"}: ${message || "message"}`;
    const url = source === "local" ? svgDataUri(svg) : shieldsUrl;
    if (outKind === "markdown") return `![${alt}](${url})`;
    if (outKind === "html") return `<img alt="${alt}" src="${url}" />`;
    return url;
  }, [outKind, source, svg, shieldsUrl, label, message]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [output]);

  const hexInput = color.startsWith("#") ? color.slice(1) : NAMED[color] ?? color;

  return (
    <div className="fade-rise">
      <ToolHead
        title="徽章生成"
        lede="shields.io 风格徽章，本地实时渲染"
        chip={
          <span>
            <IconShield width={12} height={12} />
            {source === "local" ? "本地渲染 · 免网络" : "shields.io 在线"}
          </span>
        }
      />

      <div className="single-panel">
        <div className="badge-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUri(svg)} alt="徽章预览" />
        </div>

        <div className="form-grid">
          <label className="form-row">
            <span>Label 左侧文案</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="build" />
          </label>
          <label className="form-row">
            <span>Message 右侧文案</span>
            <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="passing" />
          </label>

          <div className="form-row form-col-span">
            <span>颜色</span>
            <div className="badge-colors">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`swatch ${color === c.name ? "active" : ""}`}
                  style={{ background: `#${c.hex}` }}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
              <span className="hex-field">
                <span>#</span>
                <input
                  className="input"
                  value={hexInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                    setColor(v ? `#${v}` : "");
                  }}
                  placeholder="自定义 hex"
                />
              </span>
            </div>
          </div>

          <label className="form-row">
            <span>样式</span>
            <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Logo 颜色（可选）</span>
            <input className="input" value={logoColor} onChange={(e) => setLogoColor(e.target.value)} placeholder="white" />
          </label>

          <div className="form-row form-col-span">
            <span>Logo 图标（Simple Icons，可选）</span>
            <div className="icon-picker" ref={iconBoxRef}>
              <div className="icon-input-row">
                <IconSearch width={14} height={14} className="icon-input-ic" />
                <input
                  className="input"
                  value={logo}
                  onChange={(e) => {
                    setLogo(e.target.value);
                    setIconPath(null);
                  }}
                  onFocus={() => {
                    setIconOpen(true);
                    setIconQuery("");
                  }}
                  placeholder="搜索图标，如 github / docker / react"
                  aria-label="图标名称"
                />
                {logo && (
                  <button type="button" className="icon-clear" onClick={() => { setLogo(""); setIconPath(null); }} aria-label="清除图标">
                    <IconX width={13} height={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.open("https://simpleicons.org/", "_blank", "noopener")}
                >
                  全部图标
                </button>
              </div>
              {iconOpen && (
                <div className="icon-list">
                  {iconMatches.length === 0 ? (
                    <div className="icon-empty">未找到匹配图标</div>
                  ) : (
                    iconMatches.map((i) => (
                      <button
                        key={i.key}
                        type="button"
                        className={`icon-item ${logo === i.slug ? "active" : ""}`}
                        onClick={() => void pickIcon(i)}
                      >
                        <span className="icon-chip" style={{ background: `#${i.hex}` }} />
                        <span className="icon-name">{i.title}</span>
                        <span className="icon-slug">{i.slug}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="tool-row">
          <div className="seg" role="group" aria-label="渲染来源">
            {(["local", "shields"] as SourceKind[]).map((k) => (
              <button key={k} data-active={source === k} onClick={() => setSource(k)} type="button">
                {k === "local" ? "本地" : "shields.io"}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="输出格式">
            {(["markdown", "html", "link"] as OutKind[]).map((k) => (
              <button key={k} data-active={outKind === k} onClick={() => setOutKind(k)} type="button">
                {k === "markdown" ? "Markdown" : k === "html" ? "HTML" : "直链"}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={() => void copy()} type="button">
            {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
            {copied ? "已复制" : "复制"}
          </button>
        </div>

        <pre className="badge-out">{output}</pre>

        <p className="count-hint">
          {source === "local"
            ? "本地模式：徽章直接内嵌为 data URI，无需访问外部网络即可渲染；粘贴到 Markdown / HTML 均可显示。"
            : "shields.io 模式：徽章由 shields.io 在线渲染（需要网络）。"}
          颜色支持预设或任意 hex（# 可不填）；图标来自 Simple Icons，搜索即选，也可在 simpleicons.org 浏览全部。
        </p>
      </div>
    </div>
  );
}
