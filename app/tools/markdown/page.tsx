"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconDocText, IconDownload, IconPrinter, IconShield } from "@/components/icons";

type MdTheme = "light" | "dark" | "sepia";

const THEMES: { id: MdTheme; label: string }[] = [
  { id: "light", label: "明亮" },
  { id: "dark", label: "暗色" },
  { id: "sepia", label: "羊皮纸" },
];

const SAMPLE = `# Markdown 实时预览

支持 **加粗**、*斜体*、~~删除线~~、\`行内代码\` 与[链接](https://github.com/lsx-xyg/tools)。

## 列表

- 无序列表项
- 另一个列表项

1. 有序列表一
2. 有序列表二

## 代码块（自动高亮）

\`\`\`ts
function greet(name: string) {
  return \`你好，\${name}\`;
}

const nums = [1, 2, 3].map((n) => n * 2);
console.log(nums); // [2, 4, 6]
\`\`\`

\`\`\`bash
npm run build && npm run deploy
\`\`\`

## 引用与表格

> 千里之行，始于足下。

| 功能 | 状态 |
| --- | --- |
| 实时预览 | ✅ |
| 代码高亮 | ✅ |
| 多主题 | ✅ |
| 同步滚动 | ✅ |

---

**开始编辑左侧内容**，右侧实时渲染。
`;

/** 打印专用 CSS（不随预览主题变化） */
const PRINT_CSS = `
* { box-sizing: border-box; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #23201a; line-height: 1.75; max-width: 820px; margin: 24px auto; padding: 0 24px; }
.md-body h1, .md-body h2, .md-body h3 { margin: 1.2em 0 0.5em; line-height: 1.3; }
.md-body h1 { font-size: 1.6em; border-bottom: 1px solid #e6e2d9; padding-bottom: 0.3em; }
.md-body h2 { font-size: 1.3em; }
.md-body code { font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 0.9em; }
.md-body :not(pre) > code { background: #f2efe9; padding: 0.15em 0.4em; border-radius: 4px; }
.md-body pre { background: #faf9f6; border: 1px solid #e6e2d9; border-radius: 8px; padding: 12px 14px; overflow: auto; }
.md-body pre code { display: block; }
.md-body blockquote { margin: 1em 0; padding: 0.1em 1em; border-left: 3px solid #c2410c; color: #5c564b; background: #faf9f6; }
.md-body table { border-collapse: collapse; margin: 1em 0; width: 100%; }
.md-body th, .md-body td { border: 1px solid #e6e2d9; padding: 6px 10px; text-align: left; }
.md-body th { background: #f2efe9; }
.md-body img { max-width: 100%; }
.md-body hr { border: none; border-top: 1px solid #e6e2d9; margin: 1.5em 0; }
`;

// 代码高亮（highlight.js 核心 token 色，按主题三套）
const HLJS_LIGHT = `
.hljs{color:#24292e;background:transparent}
.hljs-comment,.hljs-quote{color:#6a737d;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#d73a49;font-weight:600}
.hljs-string,.hljs-doctag,.hljs-regexp{color:#032f62}
.hljs-number,.hljs-attr,.hljs-attribute,.hljs-variable{color:#005cc5}
.hljs-title,.hljs-title.function_,.hljs-section{color:#6f42c1}
.hljs-built_in,.hljs-type,.hljs-class .hljs-title{color:#005cc5}
.hljs-meta{color:#24292e}
.hljs-symbol,.hljs-bullet,.hljs-link{color:#e36209}
.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:600}
`;
const HLJS_DARK = `
.hljs{color:#e6edf3;background:transparent}
.hljs-comment,.hljs-quote{color:#8b949e;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#ff7b72;font-weight:600}
.hljs-string,.hljs-doctag,.hljs-regexp{color:#a5d6ff}
.hljs-number,.hljs-attr,.hljs-attribute,.hljs-variable{color:#79c0ff}
.hljs-title,.hljs-title.function_,.hljs-section{color:#d2a8ff}
.hljs-built_in,.hljs-type,.hljs-class .hljs-title{color:#ffa657}
.hljs-meta{color:#e6edf3}
.hljs-symbol,.hljs-bullet,.hljs-link{color:#ffa657}
.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:600}
`;
const HLJS_SEPIA = `
.hljs{color:#4f3a25;background:transparent}
.hljs-comment,.hljs-quote{color:#9a8a6a;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#a03a1e;font-weight:600}
.hljs-string,.hljs-doctag,.hljs-regexp{color:#5a5a1e}
.hljs-number,.hljs-attr,.hljs-attribute,.hljs-variable{color:#2f4f4f}
.hljs-title,.hljs-title.function_,.hljs-section{color:#6b3d7a}
.hljs-built_in,.hljs-type,.hljs-class .hljs-title{color:#2f4f4f}
.hljs-meta{color:#4f3a25}
.hljs-symbol,.hljs-bullet,.hljs-link{color:#9a6b1e}
.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:600}
`;
const HLJS_THEMES: Record<MdTheme, string> = { light: HLJS_LIGHT, dark: HLJS_DARK, sepia: HLJS_SEPIA };

// 配置 marked：代码高亮
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : "";
      let highlighted = "";
      if (language) {
        try {
          highlighted = hljs.highlight(text, { language }).value;
        } catch {
          highlighted = "";
        }
      }
      if (!highlighted) {
        try {
          highlighted = hljs.highlightAuto(text).value;
        } catch {
          highlighted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
      }
      const cls = language ? `hljs language-${language}` : "hljs";
      return `<pre><code class="${cls}">${highlighted}</code></pre>`;
    },
  },
});

export default function MarkdownPage() {
  const [md, setMd] = useState(SAMPLE);
  const [theme, setTheme] = useState<MdTheme>("light");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const deferred = useDeferredValue(md);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const syncLock = useRef(false);

  // DOMPurify 依赖浏览器 DOM，SSR 阶段不可用：挂载后再执行清洗，避免 hydration 不一致
  useEffect(() => {
    setMounted(true);
  }, []);

  const rendered = useMemo(() => {
    if (!mounted || !deferred.trim()) return "";
    try {
      const html = marked.parse(deferred, { async: false }) as string;
      return DOMPurify.sanitize(html);
    } catch {
      return "<p class=\"err\">解析失败</p>";
    }
  }, [deferred, mounted]);

  const fullHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Markdown 导出</title>
<style>${PRINT_CSS}\n${HLJS_LIGHT}</style>
</head>
<body>
<div class="md-body">
${rendered}
</div>
</body>
</html>`;
  }, [rendered]);

  const copyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [fullHtml]);

  const downloadHtml = useCallback(() => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([fullHtml], { type: "text/html;charset=utf-8" }));
    a.download = "markdown.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [fullHtml]);

  const printPdf = useCallback(() => {
    const win = window.open("", "_blank", "noopener");
    if (!win) return;
    win.document.write(fullHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }, [fullHtml]);

  // 同步滚动：编辑 ↔ 预览按滚动比例联动
  const syncScroll = useCallback((from: "editor" | "preview") => {
    if (syncLock.current) return;
    const ed = editorRef.current;
    const pv = previewRef.current;
    if (!ed || !pv) return;
    const src = from === "editor" ? ed : pv;
    const dst = from === "editor" ? pv : ed;
    const maxSrc = src.scrollHeight - src.clientHeight;
    const maxDst = dst.scrollHeight - dst.clientHeight;
    if (maxSrc <= 0 || maxDst <= 0) return;
    syncLock.current = true;
    dst.scrollTop = (src.scrollTop / maxSrc) * maxDst;
    requestAnimationFrame(() => {
      syncLock.current = false;
    });
  }, []);

  return (
    <div className="fade-rise">
      <style>{HLJS_THEMES[theme]}</style>
      <ToolHead
        title="Markdown 编辑器"
        lede="实时预览 · 代码高亮 · 多主题 · 转 HTML / PDF"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地渲染 · 不上传
          </span>
        }
      />

      <div className="tool-row">
        <button className="btn btn-ghost btn-sm" onClick={() => setMd(SAMPLE)} type="button">
          <IconDocText width={14} height={14} />
          示例
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMd("")} type="button">
          清空
        </button>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => void copyHtml()} type="button">
          {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
          {copied ? "已复制" : "复制 HTML"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={downloadHtml} type="button">
          <IconDownload width={14} height={14} />
          下载 .html
        </button>
        <button className="btn btn-primary btn-sm" onClick={printPdf} type="button">
          <IconPrinter width={14} height={14} />
          导出 PDF
        </button>
      </div>

      <div className="md-grid">
        <div className="panel">
          <div className="panel-head">
            <span className="label">
              <IconDocText width={14} height={14} />
              Markdown
            </span>
            <span className="right label">{md.length} 字符</span>
          </div>
          <textarea
            ref={editorRef}
            className="md-editor"
            value={md}
            onChange={(e) => setMd(e.target.value)}
            onScroll={() => syncScroll("editor")}
            spellCheck={false}
            placeholder="输入 Markdown…"
            aria-label="Markdown 编辑器"
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="label">预览</span>
            <span className="right">
              <span className="seg seg-thumb" role="group" aria-label="预览主题">
                {THEMES.map((t) => (
                  <button key={t.id} data-active={theme === t.id} onClick={() => setTheme(t.id)} type="button">
                    {t.label}
                  </button>
                ))}
              </span>
            </span>
          </div>
          <div className={`md-body md-preview md-theme-${theme}`} ref={previewRef} onScroll={() => syncScroll("preview")} dangerouslySetInnerHTML={{ __html: rendered }} />
        </div>
      </div>
    </div>
  );
}
