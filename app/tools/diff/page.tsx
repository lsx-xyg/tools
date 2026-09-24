"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconFileDiff, IconShield } from "@/components/icons";
import { diffText } from "@/lib/diff";

export default function DiffPage() {
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");

  const result = useMemo(() => {
    if (!oldText && !newText) return null;
    return diffText(oldText, newText);
  }, [oldText, newText]);

  return (
    <div className="fade-rise">
      <ToolHead
        title="文本 Diff 对比"
        lede="两栏对比，行级差异高亮"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="diff-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="label">原文本</span>
            <span className="count-hint">{oldText.length} 字符</span>
          </div>
          <textarea
            className="input textarea tall mono"
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            placeholder="粘贴原来的文本…"
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="label">新文本</span>
            <span className="count-hint">{newText.length} 字符</span>
          </div>
          <textarea
            className="input textarea tall mono"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="粘贴修改后的文本…"
            spellCheck={false}
          />
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="label">
            <IconFileDiff width={14} height={14} />
            差异
          </span>
          <span className="right">
            {result && (
              <span className="count-hint">
                <b className="diff-add">+{result.stat.added}</b>
                {" · "}
                <b className="diff-del">-{result.stat.removed}</b>
              </span>
            )}
          </span>
        </div>
        <div className="diff-view mono">
          {!result ? (
            <p className="count-hint">输入两段文本后自动对比</p>
          ) : (
            result.chunks.map((c, i) => (
              <pre key={i} className={`diff-line ${c.added ? "add" : c.removed ? "del" : "same"}`}>
                {c.added ? "+ " : c.removed ? "- " : "  "}
                {c.value.replace(/\n$/, "") || "␊"}
              </pre>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
