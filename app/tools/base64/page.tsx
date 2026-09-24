"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconShield } from "@/components/icons";

type Mode = "encode" | "decode";

/** 大输入分段处理，避免 btoa 栈溢出 */
function encodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(out);
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export default function Base64Page() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input) return { output: "", error: "" };
    try {
      if (mode === "encode") {
        return { output: encodeUtf8(input), error: "" };
      }
      return { output: decodeBase64(input), error: "" };
    } catch {
      return {
        output: "",
        error: mode === "decode" ? "不是有效的 Base64（含空格自动忽略，其他非法字符请检查）" : "编码失败",
      };
    }
  }, [input, mode]);

  async function copy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="Base64 编码"
        lede="文本与 Base64 互转，中文 / emoji 不乱码"
        chip={
          <span>
            <IconShield width={12} height={12} />
            UTF-8 安全
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="转换方向">
        <button data-active={mode === "encode"} onClick={() => setMode("encode")} type="button">
          文本 → Base64
        </button>
        <button data-active={mode === "decode"} onClick={() => setMode("decode")} type="button">
          Base64 → 文本
        </button>
      </div>

      <div className="transfer-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">{mode === "encode" ? "原文" : "Base64"}</span>
            <span className="count-hint">{input.length} 字符</span>
          </div>
          <div className="panel-body">
            <textarea
              className="input textarea tall"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "encode" ? "输入要编码的文本…" : "粘贴 Base64 字符串…（含换行/空格自动忽略）"
              }
              spellCheck={false}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">{mode === "encode" ? "Base64 结果" : "原文"}</span>
            <span className="right">
              {output && (
                <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button" disabled={copied}>
                  {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                  {copied ? "已复制" : "复制"}
                </button>
              )}
            </span>
          </div>
          <div className="panel-body">
            <textarea
              className="input textarea tall mono"
              value={error ? "" : output}
              readOnly
              placeholder={error ? "" : "结果在这里…"}
            />
            {error && <p className="count-hint warn" style={{ marginTop: 10 }}>{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
