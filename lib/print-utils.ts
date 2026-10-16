/**
 * 文件打印工具（T-41）——上传 PDF / 图片 / Word / 文本，预览后用浏览器调用本机打印机。
 * 打印走 window.print() 弹出系统打印对话框（选本机连接的打印机），纯前端、文件不上传。
 */
import type { FileItem } from "./print-types";

export interface PaperSize {
  id: string;
  label: string;
  /** CSS @page size 关键词（宽×高 mm） */
  css: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { id: "a4", label: "A4", css: "A4", widthMm: 210, heightMm: 297 },
  { id: "a5", label: "A5", css: "A5", widthMm: 148, heightMm: 210 },
  { id: "letter", label: "Letter", css: "Letter", widthMm: 215.9, heightMm: 279.4 },
  { id: "legal", label: "Legal", css: "Legal", widthMm: 215.9, heightMm: 355.6 },
];

export interface PrintOptions {
  paperId: string;
  orientation: "portrait" | "landscape";
  /** 打印清晰度（PDF 渲染 DPI，决定栅格化 scale） */
  dpi: number;
  /** 页边距 mm */
  marginMm: number;
}

/** 生成单个打印文件对应的页 HTML 片段 */
export async function renderPagesHtml(item: FileItem, opts: PrintOptions): Promise<string> {
  const paper = PAPER_SIZES.find((p) => p.id === opts.paperId) ?? PAPER_SIZES[0];
  const w = opts.orientation === "portrait" ? paper.widthMm : paper.heightMm;
  const h = opts.orientation === "portrait" ? paper.heightMm : paper.widthMm;
  const pad = Math.max(0, opts.marginMm);

  const pageCss = `width:${w}mm;height:${h}mm;box-sizing:border-box;padding:${pad}mm;` +
    `display:flex;align-items:center;justify-content:center;overflow:hidden;page-break-after:always;`;

  if (item.kind === "pdf") {
    const { pdfToImages } = await import("@/lib/pdf-utils");
    const blobs = await pdfToImages(await item.file.arrayBuffer(), {
      scale: opts.dpi / 72,
      format: "jpeg",
      quality: 0.92,
    });
    const urls = blobs.map((b) => URL.createObjectURL(b.blob));
    const pages = urls
      .map((u) => `<div class="page" style="${pageCss}"><img src="${u}" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>`)
      .join("");
    return pages;
  }

  if (item.kind === "image") {
    const url = URL.createObjectURL(item.file);
    return `<div class="page" style="${pageCss}"><img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>`;
  }

  if (item.kind === "word") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await item.file.arrayBuffer() });
    return `<div class="page-html" style="width:${w}mm;min-height:${h}mm;box-sizing:border-box;padding:${pad}mm;page-break-after:always;font-size:12px;line-height:1.5;">${value}</div>`;
  }

  if (item.kind === "text") {
    const text = await item.file.text();
    const esc = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="page-html" style="width:${w}mm;min-height:${h}mm;box-sizing:border-box;padding:${pad}mm;page-break-after:always;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${esc}</div>`;
  }

  return "";
}

/** 组装打印 iframe HTML 并触发系统打印对话框 */
export function printPages(htmls: string[], opts: PrintOptions): Promise<void> {
  const paper = PAPER_SIZES.find((p) => p.id === opts.paperId) ?? PAPER_SIZES[0];
  const size = `${paper.css} ${opts.orientation}`;
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-99999px";
    iframe.style.top = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      reject(new Error("无法创建打印页"));
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: ${size}; margin: 0; }
      html, body { margin: 0; padding: 0; }
      .page, .page-html { box-sizing: border-box; }
      img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { border-collapse: collapse; }
    </style></head><body>${htmls.join("")}</body></html>`);
    doc.close();

    // 等所有图片（含懒加载）渲染完成再打印
    const all = Array.from(doc.images);
    if (all.length === 0) {
      // 纯文本/HTML：直接打印
      schedulePrint(iframe, resolve, reject);
      return;
    }
    let pending = all.length;
    let failed = false;
    const onLoad = () => {
      pending -= 1;
      if (pending <= 0) schedulePrint(iframe, resolve, reject);
    };
    all.forEach((img) => {
      if (img.complete) {
        onLoad();
      } else {
        img.onload = onLoad;
        img.onerror = () => {
          failed = true;
          onLoad();
        };
      }
    });
    // 兜底超时（避免某图永远不触发）
    setTimeout(() => {
      if (pending > 0) schedulePrint(iframe, resolve, reject);
    }, 8000);
    if (failed) {
      reject(new Error("部分页面渲染失败，可重试"));
    }
  });
}

function schedulePrint(
  iframe: HTMLIFrameElement,
  resolve: () => void,
  reject: (e: Error) => void,
) {
  try {
    const win = iframe.contentWindow;
    if (!win) throw new Error("打印窗口不可用");
    const onAfter = () => {
      window.removeEventListener("focus", onFocus);
      cleanup();
      resolve();
    };
    const onFocus = () => setTimeout(onAfter, 0);
    const cleanup = () => {
      setTimeout(() => iframe.remove(), 500);
    };
    win.focus();
    win.print(); // 弹出系统打印对话框，用户选择本机打印机
    window.addEventListener("focus", onFocus);
    setTimeout(cleanup, 30000); // 兜底：30s 后清理
  } catch (e) {
    iframe.remove();
    reject(e instanceof Error ? e : new Error("打印失败"));
  }
}
