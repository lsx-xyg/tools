"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconShield, IconTextSearch } from "@/components/icons";

const FLAGS: { id: string; tip: string }[] = [
  { id: "g", tip: "全局匹配：查找所有匹配项，而非仅第一个" },
  { id: "i", tip: "忽略大小写：匹配时不区分字母大小写" },
  { id: "m", tip: "多行模式：^ 和 $ 匹配每一行的开头 / 结尾" },
  { id: "s", tip: "单行模式（dotAll）：让 . 也能匹配换行符" },
];

export default function RegexPage() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<string[]>(["g"]);
  const [text, setText] = useState("");

  const result = useMemo(() => {
    if (!pattern || !text) return null;
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.join(""));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "正则无效" };
    }
    const matches: { m: string; index: number; groups: (string | undefined)[] }[] = [];
    let lastIndex = 0;
    if (flags.includes("g")) {
      re.lastIndex = 0;
      let mm: RegExpExecArray | null;
      let guard = 0;
      while ((mm = re.exec(text)) !== null && guard < 10_000) {
        if (mm[0] === "") {
          re.lastIndex += 1;
          continue;
        }
        matches.push({ m: mm[0], index: mm.index, groups: mm.slice(1) });
        guard += 1;
        if (mm.index === re.lastIndex) re.lastIndex += 1;
      }
    } else {
      const mm = re.exec(text);
      if (mm) matches.push({ m: mm[0], index: mm.index, groups: mm.slice(1) });
    }
    return { matches };
  }, [pattern, flags, text]);

  function toggleFlag(f: string) {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  /** 高亮渲染：所有匹配区间着色 */
  function renderHighlight(): React.ReactNode {
    if (!result || "error" in result || result.matches.length === 0) return null;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    result.matches.forEach(({ m, index }, i) => {
      if (index > cursor) nodes.push(<span key={`t${i}`}>{text.slice(cursor, index)}</span>);
      nodes.push(
        <mark className="re-match" key={`m${i}`}>
          {m}
        </mark>,
      );
      cursor = index + m.length;
    });
    if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
    return nodes;
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="正则测试器"
        lede="匹配预览与捕获组查看，实时高亮"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="tool-row">
          <input
            className="input mono"
            style={{ flex: 1 }}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="正则表达式，如 \d+\.\d+"
            spellCheck={false}
          />
          <div className="seg" role="group" aria-label="正则标志">
            {FLAGS.map((f) => (
              <span className="tip-wrap" key={f.id}>
                <button
                  data-active={flags.includes(f.id)}
                  onClick={() => toggleFlag(f.id)}
                  type="button"
                  aria-label={`${f.id} 标志：${f.tip}`}
                >
                  {f.id}
                </button>
                <span className="tip" role="tooltip">{f.tip}</span>
              </span>
            ))}
          </div>
        </div>
        <textarea
          className="input textarea tall mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴要匹配的文本…"
          spellCheck={false}
        />

        {result && "error" in result ? (
          <p className="count-hint warn" style={{ marginTop: 10 }}>
            正则无效：{result.error}
          </p>
        ) : (
          <>
            <div className="re-preview mono">{renderHighlight() || <p className="count-hint">无匹配</p>}</div>
            {result && result.matches.length > 0 && (
              <div className="re-list">
                <div className="panel-head">
                  <span className="label">
                    <IconTextSearch width={14} height={14} />
                    {result.matches.length} 个匹配
                  </span>
                </div>
                {result.matches.map((m, i) => (
                  <div className="re-row" key={i}>
                    <code className="mono">{m.m}</code>
                    <span className="count-hint">
                      @{m.index} · 长 {m.m.length}
                      {m.groups.length > 0 && (
                        <span className="mono" style={{ color: "var(--muted)" }}>
                          {" "}
                          组 ({m.groups.map((g, j) => `$${j + 1}=${g ?? "∅"}`).join(" ")})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
