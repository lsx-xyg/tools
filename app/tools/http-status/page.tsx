"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconActivity, IconCheck, IconCopy, IconShield } from "@/components/icons";
import { HTTP_GROUPS, HTTP_STATUS, searchStatus } from "@/lib/http-status";
import { TruncatedText } from "@/components/tooltip";

export default function HttpStatusPage() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");

  const hits = useMemo(() => searchStatus(query), [query]);

  async function copy(code: number, name: string) {
    const text = `${code} ${name}`;
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
        title="HTTP 状态码"
        lede="状态码速查：数字、英文名、中文含义"
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
            <IconActivity width={14} height={14} />
            状态码表
          </span>
          <span className="count-hint">{hits.length} / {HTTP_STATUS.length} 条</span>
        </div>
        <div className="panel-body">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索状态码或含义，如 404 / timeout / 超时…"
            spellCheck={false}
          />
          <div className="status-list">
            {HTTP_GROUPS.map((g) => {
              const items = hits.filter((h) => h.group === g.group);
              if (items.length === 0) return null;
              return (
                <div className="status-group" key={g.group}>
                  <div className="status-group-title">
                    <span className="label">{g.label}</span>
                    <span className="count-hint">{g.hint}</span>
                  </div>
                  {items.map((s) => {
                    const text = `${s.code} ${s.name}`;
                    return (
                      <button className="status-row" onClick={() => void copy(s.code, s.name)} type="button" key={s.code}>
                        <span className="status-code mono">{s.code}</span>
                        <TruncatedText text={s.name} className="status-name mono" />
                        <TruncatedText text={s.zh} className="status-zh" />
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
                </div>
              );
            })}
            {!query && <p className="count-hint">全部状态码已展示 · 点击条目一键复制</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
