"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCopy, IconFileType, IconCheck, IconShield } from "@/components/icons";
import { lookupMime, searchTable } from "@/lib/mime";

export default function MimePage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");

  const result = useMemo(() => lookupMime(input), [input]);
  const hits = useMemo(() => searchTable(query), [query]);

  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="MIME types"
        lede="MIME 类型 ↔ 文件扩展名互查"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地查询 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="panel-head">
          <span className="label">查询</span>
          <span className="count-hint">输入 MIME（如 image/png）或扩展名（如 png）</span>
        </div>
        <input
          className="input mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="image/png 或 png 或 .jpg"
          spellCheck={false}
        />

        {input.trim() && (
          <div className="mime-result">
            {result.length === 0 ? (
              <p className="count-hint warn" style={{ marginTop: 10 }}>未收录该类型，试试下方搜索</p>
            ) : (
              result.map((r, i) => (
                <div className="kv-row" key={i}>
                  <span className="kv-key mono">{r.mime}</span>
                  <span className="kv-val mono">{r.exts.map((e) => `.${e}`).join("  ")}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => void copy(`${r.mime}  →  ${r.exts.map((e) => `.${e}`).join(" ")}`)} type="button">
                    {copied === `${r.mime}  →  ${r.exts.map((e) => `.${e}`).join(" ")}` ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                    {copied === `${r.mime}  →  ${r.exts.map((e) => `.${e}`).join(" ")}` ? "已复制" : "复制"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="label">
            <IconFileType width={14} height={14} />
            类型表
          </span>
          <span className="count-hint">{hits.length ? `${hits.length} 条匹配` : "输入关键词过滤"}</span>
        </div>
        <div className="panel-body">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 MIME 或扩展名…"
            spellCheck={false}
          />
          <div className="mime-list">
            {hits.map((r, i) => (
              <button className="mime-chip" onClick={() => setInput(r.mime)} type="button" key={i}>
                <code className="mono">{r.mime}</code>
                <span className="count-hint">{r.exts.map((e) => `.${e}`).join(" ")}</span>
              </button>
            ))}
            {!query && <p className="count-hint">输入关键词过滤，点击条目回填到查询框</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
