"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconLink, IconShield } from "@/components/icons";

type Mode = "uri" | "component" | "decode";

export default function UrlPage() {
  const [mode, setMode] = useState<Mode>("uri");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!input) return { output: "", error: "" };
    try {
      return {
        output:
          mode === "uri"
            ? encodeURI(input) // 保留 URL 骨架：协议 / 域名 / 路径 / ? & =
            : mode === "component"
              ? encodeURIComponent(input) // 全量编码：适合参数值
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
        lede="保留网址骨架编码，中文、emoji 安全"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="URL 模式">
        <button data-active={mode === "uri"} onClick={() => setMode("uri")} type="button">
          编码 · 保留骨架
        </button>
        <button data-active={mode === "component"} onClick={() => setMode("component")} type="button">
          全量编码
        </button>
        <button data-active={mode === "decode"} onClick={() => setMode("decode")} type="button">
          解码
        </button>
      </div>

      <div className="transfer-grid url-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">
              {mode === "uri" && "原文（骨架保留）"}
              {mode === "component" && "原文（全量编码）"}
              {mode === "decode" && "编码串"}
            </span>
            <span className="count-hint">{input.length} 字符</span>
          </div>
          <div className="panel-body">
            <textarea
              className="input textarea tall mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "decode" ? "%E4%B8%AD%E6%96%87%20%F0%9F%90%9F" : "https://tools.example.com/tools/url?q=🐟 & 中文"}
              spellCheck={false}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">
              {mode === "decode" ? "解码结果" : "编码结果"}
            </span>
            <span className="right">
              <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button" disabled={!result.output}>
                {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied ? "已复制" : "复制"}
              </button>
            </span>
          </div>
          <div className="panel-body">
            <textarea className="input textarea tall mono" value={result.output} readOnly placeholder="结果在这里…" spellCheck={false} />
            {result.error && <p className="count-hint warn" style={{ marginTop: 10 }}>{result.error}</p>}
          </div>
        </section>
      </div>

      <p className="count-hint" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <IconLink width={12} height={12} />
        {mode === "uri"
          ? "「保留骨架」只编码特殊字符，https://、/、?、&、= 原样保留，编码结果可直接访问"
          : mode === "component"
            ? "「全量编码」对每个字节都编码，适合作为参数值传入，不能直接作为网址访问"
            : "解码时 + 会先还原为空格，符合 query 参数惯例"}
      </p>
    </div>
  );
}
