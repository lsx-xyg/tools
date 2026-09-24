"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCopy, IconDownload, IconShield, IconZap } from "@/components/icons";
import {
  EXAMPLES,
  FORMATS,
  parseText,
  stringifyData,
  type Format,
} from "@/lib/converters";

const DEBOUNCE = 300;

export default function ConvertPage() {
  const [input, setInput] = useState("");
  const [from, setFrom] = useState<Format>("yaml");
  const [to, setTo] = useState<Format>("json");
  const [copied, setCopied] = useState(false);

  // 300ms 防抖，边输入边转换（纯本地，零网络请求）
  const [debounced, setDebounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(input), DEBOUNCE);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [input]);

  const result = useMemo(() => {
    const q = debounced.trim();
    if (!q) return { ok: false as const, error: "", output: "" };
    try {
      const data = parseText(q, from);
      return { ok: true as const, error: "", output: stringifyData(data, to) };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
        output: "",
      };
    }
  }, [debounced, from, to]);

  function copy() {
    if (!result.ok || !result.output) return;
    navigator.clipboard.writeText(result.output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function download() {
    if (!result.ok || !result.output) return;
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output.${to === "properties" ? "properties" : to}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fillExample() {
    setInput(EXAMPLES[from]);
  }

  const sameFormat = from === to;
  const dataDesc = result.ok ? describeShape(debounced, from) : "";

  return (
    <div className="fade-rise">
      <ToolHead
        title="格式互转"
        lede="YAML · XML · CSV · INI · Properties ↔ JSON，统一解析再输出"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地转换 · 不上传
          </span>
        }
      />

      <section className="panel">
        <div className="panel-head">
          <span className="label">输入</span>
          <div className="seg" role="group" aria-label="输入格式">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                data-active={from === f.id}
                onClick={() => setFrom(f.id)}
                type="button"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body">
          <textarea
            className="input textarea tall mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`粘贴 ${FORMATS.find((f) => f.id === from)?.name} 内容…`}
            spellCheck={false}
            aria-label="待转换内容"
          />
          <div className="tool-row">
            <button className="btn btn-ghost btn-sm" onClick={fillExample} type="button">
              <IconZap width={14} height={14} />
              填充示例
            </button>
            <span className="spacer" />
            <span className="count-hint">{input.length} 字符 · {dataDesc}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="label">输出</span>
          <div className="seg" role="group" aria-label="输出格式">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                data-active={to === f.id}
                onClick={() => setTo(f.id)}
                type="button"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body">
          {!result.ok ? (
            <div className="json-verdict err">
              <span className="json-verdict-title err">转换失败</span>
              <p className="count-hint" style={{ maxWidth: 420 }}>
                {result.error}
              </p>
            </div>
          ) : (
            <>
              <textarea
                className="input textarea tall mono"
                value={result.output}
                readOnly
                spellCheck={false}
                aria-label="转换结果"
              />
              <div className="tool-row">
                {sameFormat ? (
                  <span className="count-hint warn">输入与输出格式相同，结果仅做规范化</span>
                ) : (
                  <span className="count-hint ok-chip">
                    <span className="lamp ok" aria-hidden="true" />
                    转换成功
                  </span>
                )}
                <span className="spacer" />
                <button className="btn btn-ghost btn-sm" onClick={download} type="button" disabled={!result.output}>
                  <IconDownload width={14} height={14} />
                  下载
                </button>
                <button className="btn btn-primary btn-sm" onClick={copy} type="button" disabled={!result.output}>
                  <IconCopy width={14} height={14} />
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** 粗略描述解析结果的形状 */
function describeShape(text: string, from: Format): string {
  try {
    const data = parseText(text, from);
    if (Array.isArray(data)) return `数组 · ${data.length} 项`;
    if (data && typeof data === "object") {
      const keys = Object.keys(data as Record<string, unknown>);
      return `对象 · ${keys.length} 个键`;
    }
    return typeof data;
  } catch {
    return "";
  }
}
