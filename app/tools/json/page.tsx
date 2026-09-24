"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconShield } from "@/components/icons";

type Mode = "format" | "minify" | "validate";

const MAX_JSON = 4 * 1024 * 1024; // 4MB 保护

/** 从 JSON.parse 的错误信息中提取出错位置（行 : 列） */
function locateError(input: string, msg: string): string {
  const posMatch = msg.match(/position\s+(\d+)/);
  if (!posMatch) return msg;
  const pos = Number(posMatch[1]);
  const line = input.slice(0, pos).split("\n").length;
  const lastLf = input.lastIndexOf("\n", pos - 1);
  const col = pos - lastLf;
  return `第 ${line} 行 · 第 ${col} 列附近：${msg}`;
}

export default function JsonPage() {
  const [mode, setMode] = useState<Mode>("format");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!input.trim()) return { output: "", error: "", meta: "" };
    if (input.length > MAX_JSON) {
      return { output: "", error: `输入过大（${(input.length / 1024 / 1024).toFixed(1)}MB），限制 ${MAX_JSON / 1024 / 1024}MB`, meta: "" };
    }
    try {
      const value = JSON.parse(input);
      if (mode === "validate") {
        const lines = input.trim().split("\n").length;
        const type = Array.isArray(value) ? "数组" : typeof value === "object" && value !== null ? "对象" : typeof value;
        const keys = Array.isArray(value) ? `${value.length} 项` : Object.keys(value as Record<string, unknown>).length;
        return {
          output: "",
          error: "",
          meta: `语法正确 · ${type} · ${keys} · 共 ${lines} 行`,
        };
      }
      const output = mode === "minify" ? JSON.stringify(value) : JSON.stringify(value, null, 2);
      return {
        output,
        error: "",
        meta: `${output.length.toLocaleString()} 字符 · ${output.split("\n").length} 行`,
      };
    } catch (e) {
      return {
        output: "",
        error: locateError(input, e instanceof Error ? e.message : "解析失败"),
        meta: "",
      };
    }
  }, [input, mode]);

  async function copy() {
    if (!result.output) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="JSON 格式化"
        lede="格式化 / 校验 / 压缩，报错定位到具体行"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="JSON 操作">
        <button data-active={mode === "format"} onClick={() => setMode("format")} type="button">
          格式化
        </button>
        <button data-active={mode === "minify"} onClick={() => setMode("minify")} type="button">
          压缩
        </button>
        <button data-active={mode === "validate"} onClick={() => setMode("validate")} type="button">
          校验
        </button>
      </div>

      <div className="transfer-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">输入</span>
            <span className="count-hint">{input.length} 字符</span>
          </div>
          <div className="panel-body">
            <textarea
              className="input textarea tall"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"key": "value", "list": [1, 2, 3]}'
              spellCheck={false}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">{mode === "validate" ? "校验结果" : "输出"}</span>
            <span className="right">
              {result.output && <span className="count-hint" style={{ marginRight: 10 }}>{result.meta}</span>}
              {result.output && (
                <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button" disabled={copied}>
                  {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                  {copied ? "已复制" : "复制"}
                </button>
              )}
            </span>
          </div>
          <div className="panel-body">
            {mode === "validate" ? (
              <div className="json-verdict">
                {!input.trim() ? (
                  <p className="count-hint">输入 JSON 后自动校验</p>
                ) : result.error ? (
                  <>
                    <p className="json-verdict-title err">
                      <span className="lamp err" aria-hidden="true" />
                      语法错误
                    </p>
                    <p className="count-hint warn">{result.error}</p>
                  </>
                ) : (
                  <>
                    <p className="json-verdict-title ok">
                      <span className="lamp ok" aria-hidden="true" />
                      语法正确
                    </p>
                    <p className="count-hint" style={{ color: "var(--ok)" }}>{result.meta}</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <textarea
                  className="input textarea tall mono"
                  value={result.output}
                  readOnly
                  placeholder={result.error ? "" : "结果在这里…"}
                />
                {result.error && <p className="count-hint warn" style={{ marginTop: 10 }}>{result.error}</p>}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
