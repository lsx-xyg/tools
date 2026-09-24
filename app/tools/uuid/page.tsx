"use client";

import { useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconFingerprint, IconRefresh, IconShield } from "@/components/icons";

function uuidV4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Variant = "standard" | "upper" | "naked";

const COUNTS = [1, 5, 10, 20];

export default function UuidPage() {
  const [count, setCount] = useState(5);
  const [variant, setVariant] = useState<Variant>("standard");
  const [list, setList] = useState<string[]>(() => Array.from({ length: 5 }, uuidV4));
  const [copied, setCopied] = useState("");
  const [allCopied, setAllCopied] = useState(false);

  function fmt(u: string): string {
    if (variant === "upper") return u.toUpperCase();
    if (variant === "naked") return u.replaceAll("-", "");
    return u;
  }

  function regenerate() {
    setList(Array.from({ length: count }, uuidV4));
    setCopied("");
    setAllCopied(false);
  }

  async function copyOne(u: string) {
    try {
      await navigator.clipboard.writeText(fmt(u));
      setCopied(u);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      /* 忽略 */
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(list.map(fmt).join("\n"));
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="UUID 生成"
        lede="批量生成 UUID v4，本地随机，不依赖服务器"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地生成 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="tool-row">
          <div className="seg" role="group" aria-label="生成数量">
            {COUNTS.map((n) => (
              <button data-active={count === n} onClick={() => setCount(n)} type="button" key={n}>
                {n} 个
              </button>
            ))}
          </div>
          <span className="spacer" />
          <div className="seg" role="group" aria-label="格式">
            <button data-active={variant === "standard"} onClick={() => setVariant("standard")} type="button">
              标准
            </button>
            <button data-active={variant === "upper"} onClick={() => setVariant("upper")} type="button">
              大写
            </button>
            <button data-active={variant === "naked"} onClick={() => setVariant("naked")} type="button">
              无横线
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={regenerate} type="button">
            <IconRefresh width={14} height={14} />
            生成
          </button>
        </div>

        <div className="uuid-list">
          {list.map((u) => (
            <div className="uuid-row" key={u}>
              <code className="mono">{fmt(u)}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => void copyOne(u)} type="button">
                {copied === u ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied === u ? "已复制" : "复制"}
              </button>
            </div>
          ))}
        </div>

        <div className="tool-row">
          <button className="btn btn-ghost btn-sm" onClick={() => void copyAll()} type="button">
            {allCopied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
            {allCopied ? "已复制全部" : "复制全部"}
          </button>
          <span className="count-hint">
            <IconFingerprint width={12} height={12} />
            UUID v4 · 122 位随机
          </span>
        </div>
      </div>
    </div>
  );
}
