"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconClock, IconCopy } from "@/components/icons";

/** Unix 秒 → 本地时间串 */
const fmt = (ms: number) => new Date(ms).toLocaleString("zh-CN", { hour12: false });
/** 相对时间描述 */
function relative(ms: number): string {
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60000);
  if (abs < 60_000) return `${Math.floor(abs / 1000)} 秒${diff >= 0 ? "前" : "后"}`;
  const h = Math.floor(m / 60);
  if (m < 60) return `${m} 分钟${diff >= 0 ? "前" : "后"}`;
  const d = Math.floor(h / 24);
  if (h < 24) return `${h} 小时${diff >= 0 ? "前" : "后"}`;
  return `${d} 天${diff >= 0 ? "前" : "后"}`;
}

export default function TsPage() {
  const [now, setNow] = useState(() => Date.now());
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const result = useMemo(() => {
    const q = input.trim();
    if (!q) return null;
    // 1) 纯数字 → 时间戳（自动识别秒 / 毫秒）
    if (/^\d{9,13}$/.test(q)) {
      const n = Number(q);
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return [
        ["本地时间", fmt(ms)],
        ["UTC 时间", d.toUTCString()],
        ["ISO 8601", d.toISOString()],
        ["相对时间", relative(ms)],
        ["毫秒时间戳", String(ms)],
      ] as const;
    }
    // 2) 日期时间 → 时间戳
    const t = Date.parse(q);
    if (Number.isNaN(t)) return null;
    return [
      ["秒时间戳", String(Math.floor(t / 1000))],
      ["毫秒时间戳", String(t)],
      ["UTC 时间", new Date(t).toUTCString()],
      ["相对时间", relative(t)],
    ] as const;
  }, [input]);

  async function copy(v: string, key: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(key);
      setTimeout(() => setCopied(""), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="时间戳转换"
        lede="Unix 时间 ↔ 日期时间，自动识别秒 / 毫秒"
        chip={
          <span>
            <IconClock width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="ts-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">当前时间戳</span>
            <span className="count-hint">每秒刷新</span>
          </div>
          <div className="panel-body">
            <div className="hash-card">
              <div className="hash-card-label">秒</div>
              <code className="hash-card-value">{Math.floor(now / 1000)}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => void copy(String(Math.floor(now / 1000)), "s")} type="button">
                {copied === "s" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied === "s" ? "已复制" : "复制"}
              </button>
            </div>
            <div className="hash-card">
              <div className="hash-card-label">毫秒</div>
              <code className="hash-card-value">{now}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => void copy(String(now), "ms")} type="button">
                {copied === "ms" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied === "ms" ? "已复制" : "复制"}
              </button>
            </div>
            <p className="count-hint" style={{ marginTop: 8 }}>{fmt(now)}</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">转换</span>
            <span className="count-hint">支持时间戳或日期</span>
          </div>
          <div className="panel-body">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="1727000000 或 2026-09-24 10:00:00"
              spellCheck={false}
            />
            {result ? (
              <div className="kv-list">
                {result.map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <span className="kv-key">{k}</span>
                    <span className="kv-val mono">{v}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => void copy(v, k)} type="button">
                      {copied === k ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                      {copied === k ? "已复制" : "复制"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="count-hint" style={{ marginTop: 12 }}>
                {input.trim() ? "无法识别：请输入 9~13 位时间戳或可解析的日期" : "输入时间戳或日期后自动转换"}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
