"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconDocText, IconDownload, IconPrinter, IconShield } from "@/components/icons";

const SAMPLE = `# Markdown 实时预览

支持 **加粗**、*斜体*、~~删除线~~、\`行内代码\` 与[链接](https://github.com/lsx-xyg/tools)。

## 列表

- 无序列表项
- 另一个列表项

1. 有序列表一
2. 有序列表二

## 代码块

\`\`\`ts
function greet(name: string) {
  return \`你好，\${name}\`;
}
\`\`\`

## 引用与表格

> 千里之行，始于足下。

| 功能 | 状态 |
| --- | --- |
| 实时预览 | ✅ |
| 转 HTML | ✅ |
| 转 PDF | ✅ |

---

**开始编辑左侧内容**，右侧实时渲染。
`;

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

export default function MarkdownPage() {
  const [md, setMd] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const deferred = useDeferredValue(md);

  const rendered = useMemo(() => {
    if (!deferred.trim()) return "";
    try {
      const html = marked.parse(deferred, { async: false }) as string;
      return DOMPurify.sanitize(html);
    } catch {
      return "<p class=\"err\">解析失败</p>";
    }
  }, [deferred]);

  const fullHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Markdown 导出</title>
<style>${PRINT_CSS}</style>
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

  return (
    <div className="fade-rise">
      <ToolHead
        title="Markdown 编辑器"
        lede="实时预览 · 转 HTML · 打印 PDF"
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
            className="md-editor"
            value={md}
            onChange={(e) => setMd(e.target.value)}
            spellCheck={false}
            placeholder="输入 Markdown…"
            aria-label="Markdown 编辑器"
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="label">预览</span>
            <span className="right label">GFM</span>
          </div>
          <div className="md-body md-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
        </div>
      </div>
    </div>
  );
}
