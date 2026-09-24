"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconFileType, IconShield } from "@/components/icons";
import { searchTable, MIME_TABLE } from "@/lib/mime";
import { TruncatedText } from "@/components/tooltip";

export default function MimePage() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");

  const hits = useMemo(() => searchTable(query), [query]);

  async function copy(mime: string, exts: string[]) {
    const text = `${mime}  →  ${exts.map((e) => `.${e}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
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

      <section className="panel">
        <div className="panel-head">
          <span className="label">
            <IconFileType width={14} height={14} />
            类型表
          </span>
          <span className="count-hint">{hits.length} / {MIME_TABLE.length} 条</span>
        </div>
        <div className="panel-body">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 MIME 或扩展名，如 png / webp / json…"
            spellCheck={false}
          />
          <div className="mime-list">
            {hits.map((r, i) => {
              const text = `${r.mime}  →  ${r.exts.map((e) => `.${e}`).join(" ")}`;
              return (
                <button className="mime-chip" onClick={() => void copy(r.mime, r.exts)} type="button" key={i}>
                  <TruncatedText text={r.mime} className="mono mime-name" />
                  <TruncatedText text={r.exts.map((e) => `.${e}`).join(" ")} className="count-hint" />
                  {copied === text ? (
                    <span className="chip-ok">
                      <IconCheck width={13} height={13} />
                      已复制
                    </span>
                  ) : (
                    <IconCopy width={13} height={13} className="chip-copy" />
                  )}
                </button>
              );
            })}
            {!query && <p className="count-hint">全部类型已展示 · 点击条目一键复制</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
