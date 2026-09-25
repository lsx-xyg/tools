"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconShield } from "@/components/icons";

const STYLES = [
  "flat",
  "flat-square",
  "plastic",
  "for-the-badge",
  "social",
  "popout",
  "popout-square",
];

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

export default function BadgePage() {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("blue");
  const [style, setStyle] = useState("flat");
  const [logo, setLogo] = useState("");
  const [logoColor, setLogoColor] = useState("");
  const [outKind, setOutKind] = useState<OutKind>("markdown");
  const [copied, setCopied] = useState(false);

  // shields.io 在线渲染：所有输出统一走官方 URL
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (label) p.set("label", label);
    p.set("message", message || "message");
    if (color) p.set("color", color.startsWith("#") ? color.slice(1) : color);
    p.set("style", style);
    if (logo) p.set("logo", logo);
    if (logoColor) p.set("logoColor", logoColor);
    return `https://img.shields.io/static/v1?${p.toString()}`;
  }, [label, message, color, style, logo, logoColor]);

  const output = useMemo(() => {
    const alt = `${label || "label"}: ${message || "message"}`;
    if (outKind === "markdown") return `![${alt}](${url})`;
    if (outKind === "html") return `<img alt="${alt}" src="${url}" />`;
    return url;
  }, [outKind, url, label, message]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const hexInput = color.startsWith("#") ? color.slice(1) : COLORS.find((c) => c.name === color)?.hex ?? color;

  return (
    <div className="fade-rise">
      <ToolHead
        title="徽章生成"
        lede="shields.io 风格徽章，在线实时渲染"
        chip={
          <span>
            <IconShield width={12} height={12} />
            由 shields.io 渲染
          </span>
        }
      />

      <div className="single-panel">
        <div className="badge-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="徽章预览" />
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
            <span>Logo（可选）</span>
            <div className="logo-input-row">
              <input
                className="input"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="如 github / docker / react"
                aria-label="Logo 名称"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => window.open("https://simpleicons.org/", "_blank", "noopener")}
              >
                全部图标
              </button>
            </div>
          </div>
        </div>

        <div className="tool-row">
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
          徽章由 shields.io 在线渲染（需联网）；粘贴到 Markdown / HTML 均可显示。颜色支持预设或任意 hex（# 可不填）；
          Logo 填写 Simple Icons 名称（如 github / docker），完整列表见 simpleicons.org。
        </p>
      </div>
    </div>
  );
}
