"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCase, IconCheck, IconCopy, IconShield } from "@/components/icons";

type CaseId =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "dot";

interface CaseOption {
  id: CaseId;
  name: string;
  example: string;
  apply: (s: string) => string;
}

/** 把文本切成词（保留数字、中英文、下划线/连字符分隔） */
function words(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0);
}

const CASES: CaseOption[] = [
  {
    id: "upper",
    name: "UPPERCASE",
    example: "HELLO WORLD",
    apply: (s) => s.toUpperCase(),
  },
  {
    id: "lower",
    name: "lowercase",
    example: "hello world",
    apply: (s) => s.toLowerCase(),
  },
  {
    id: "title",
    name: "Title Case",
    example: "Hello World",
    apply: (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()),
  },
  {
    id: "sentence",
    name: "Sentence case",
    example: "Hello world",
    apply: (s) => s.toLowerCase().replace(/^(\s*\w)/, (c) => c.toUpperCase()),
  },
  {
    id: "camel",
    name: "camelCase",
    example: "helloWorld",
    apply: (s) => {
      const w = words(s);
      return w.length === 0 ? "" : w[0].toLowerCase() + w.slice(1).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join("");
    },
  },
  {
    id: "pascal",
    name: "PascalCase",
    example: "HelloWorld",
    apply: (s) => words(s).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(""),
  },
  {
    id: "snake",
    name: "snake_case",
    example: "hello_world",
    apply: (s) => words(s).map((x) => x.toLowerCase()).join("_"),
  },
  {
    id: "kebab",
    name: "kebab-case",
    example: "hello-world",
    apply: (s) => words(s).map((x) => x.toLowerCase()).join("-"),
  },
  {
    id: "constant",
    name: "CONSTANT_CASE",
    example: "HELLO_WORLD",
    apply: (s) => words(s).map((x) => x.toUpperCase()).join("_"),
  },
  {
    id: "dot",
    name: "dot.case",
    example: "hello.world",
    apply: (s) => words(s).map((x) => x.toLowerCase()).join("."),
  },
];

export default function CasePage() {
  const [input, setInput] = useState("");
  const [active, setActive] = useState<CaseId>("camel");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!input) return "";
    const op = CASES.find((c) => c.id === active);
    return op ? op.apply(input) : "";
  }, [input, active]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="Case converter"
        lede="大小写与命名风格转换，支持 10 种格式"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="transfer-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">输入</span>
            <span className="count-hint">{input.length} 字符</span>
          </div>
          <textarea
            className="input textarea tall mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="hello world 或 HelloWorld 或 user_name…"
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">输出</span>
            <span className="right">
              <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button" disabled={!output}>
                {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied ? "已复制" : "复制"}
              </button>
            </span>
          </div>
          <textarea className="input textarea tall mono" value={output} readOnly placeholder="结果在这里…" spellCheck={false} />
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="label">
            <IconCase width={14} height={14} />
            格式
          </span>
          <span className="count-hint">点击切换，实时转换</span>
        </div>
        <div className="case-grid">
          {CASES.map((c) => (
            <button
              className={`case-card ${active === c.id ? "on" : ""}`}
              onClick={() => setActive(c.id)}
              type="button"
              key={c.id}
            >
              <b>{c.name}</b>
              <span className="mono">{c.example}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
