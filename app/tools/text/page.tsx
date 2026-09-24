"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconDocText, IconShield } from "@/components/icons";

type OpId =
  | "upper"
  | "lower"
  | "title"
  | "trim"
  | "collapse"
  | "stripBlank"
  | "stripSpace"
  | "sort"
  | "sortDesc"
  | "unique"
  | "reverseChar"
  | "reverseLine"
  | "extractNum"
  | "kebab"
  | "snake";

interface Op {
  id: OpId;
  name: string;
  apply: (s: string) => string;
}

const OPS: Op[] = [
  { id: "upper", name: "转大写", apply: (s) => s.toUpperCase() },
  { id: "lower", name: "转小写", apply: (s) => s.toLowerCase() },
  {
    id: "title",
    name: "首字母大写",
    apply: (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()),
  },
  { id: "trim", name: "去两端空格", apply: (s) => s.trim() },
  { id: "collapse", name: "压缩多余空格", apply: (s) => s.replace(/[ \t]+/g, " ") },
  { id: "stripBlank", name: "去除空行", apply: (s) => s.split(/\r?\n/).filter((l) => l.trim()).join("\n") },
  { id: "stripSpace", name: "去除全部空格", apply: (s) => s.replace(/\s+/g, "") },
  { id: "sort", name: "行排序 A→Z", apply: (s) => s.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join("\n") },
  {
    id: "sortDesc",
    name: "行排序 Z→A",
    apply: (s) => s.split(/\r?\n/).sort((a, b) => b.localeCompare(a)).join("\n"),
  },
  { id: "unique", name: "去重复行", apply: (s) => [...new Set(s.split(/\r?\n/))].join("\n") },
  { id: "reverseChar", name: "反转字符", apply: (s) => [...s].reverse().join("") },
  { id: "reverseLine", name: "反转行序", apply: (s) => s.split(/\r?\n/).reverse().join("\n") },
  {
    id: "extractNum",
    name: "提取数字",
    apply: (s) => (s.match(/-?\d+(\.\d+)?/g) ?? []).join("\n"),
  },
  {
    id: "kebab",
    name: "空格转连字符",
    apply: (s) => s.trim().replace(/\s+/g, "-"),
  },
  { id: "snake", name: "空格转下划线", apply: (s) => s.trim().replace(/\s+/g, "_") },
];

export default function TextPage() {
  const [input, setInput] = useState("");
  const [pipeline, setPipeline] = useState<OpId[]>([]);
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    let s = input;
    for (const id of pipeline) {
      const op = OPS.find((o) => o.id === id);
      if (op) s = op.apply(s);
    }
    return s;
  }, [input, pipeline]);

  function applyOp(id: OpId) {
    setPipeline((prev) => [...prev, id]);
  }
  function undoLast() {
    setPipeline((prev) => prev.slice(0, -1));
  }

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
        title="文本处理合集"
        lede="大小写 / 排序 / 去重 / 提取等，可叠加多个操作"
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
            placeholder="粘贴要处理的文本…"
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">输出</span>
            <span className="right">
              <span className="count-hint" style={{ marginRight: 10 }}>
                {output.length} 字符
              </span>
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
            <IconDocText width={14} height={14} />
            操作
          </span>
          {pipeline.length > 0 && (
            <span className="right">
              <span className="count-hint" style={{ marginRight: 10 }}>
                管线：{pipeline.map((id) => OPS.find((o) => o.id === id)?.name).join(" → ")}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={undoLast} type="button">
                撤销一步
              </button>
            </span>
          )}
        </div>
        <div className="op-grid">
          {OPS.map((op) => (
            <button className="op-chip" onClick={() => applyOp(op.id)} type="button" key={op.id}>
              {op.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
