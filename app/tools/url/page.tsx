"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconLink, IconShield } from "@/components/icons";

type Mode = "encode" | "decode";

export default function UrlPage() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!input) return { output: "", error: "" };
    try {
      return {
        output:
          mode === "encode"
            ? encodeURIComponent(input)
            : decodeURIComponent(input.replace(/\+/g, "%20")),
        error: "",
      };
    } catch (e) {
      return { output: "", error: e instanceof Error ? e.message : "转换失败" };
    }
  }, [input, mode]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="URL 编码 / 解码"
        lede="encodeURIComponent 全量编码，中文、emoji 安全"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="URL 模式">
        <button data-active={mode === "encode"} onClick={() => setMode("encode")} type="button">
          编码
        </button>
        <button data-active={mode === "decode"} onClick={() => setMode("decode")} type="button">
          解码
        </button>
      </div>

      <div className="transfer-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">{mode === "encode" ? "原文" : "编码串"}</span>
            <span className="count-hint">{input.length} 字符</span>
          </div>
          <textarea
            className="input textarea tall mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "https://example.com/?q=中文 & 表情 😀" : "%E4%B8%AD%E6%96%87"}
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">{mode === "encode" ? "编码结果" : "解码结果"}</span>
            <span className="right">
              <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button" disabled={!result.output}>
                {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied ? "已复制" : "复制"}
              </button>
            </span>
          </div>
          <textarea className="input textarea tall mono" value={result.output} readOnly placeholder="结果在这里…" spellCheck={false} />
          {result.error && <p className="count-hint warn" style={{ marginTop: 10 }}>{result.error}</p>}
        </section>
      </div>

      <p className="count-hint" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <IconLink width={12} height={12} />
        解码时 + 会先还原为空格，符合 query 参数惯例
      </p>
    </div>
  );
}
