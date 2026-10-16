"use client";

import { useCallback, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { FileDropZone } from "@/components/drop-zone";
import { IconPrinter, IconTrash, IconLoader } from "@/components/icons";

const KIND_LABEL: Record<FileItem["kind"], string> = {
  pdf: "PDF",
  image: "图片",
  word: "Word",
  text: "文本",
};
import { kindOf, type FileItem } from "@/lib/print-types";
import { PAPER_SIZES, printPages, renderPagesHtml, type PrintOptions } from "@/lib/print-utils";

let uid = 0;

async function makeThumb(item: FileItem): Promise<FileItem> {
  if (item.kind === "image") {
    const url = URL.createObjectURL(item.file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const max = 160;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        resolve({ ...item, thumb: c.toDataURL("image/jpeg", 0.7) });
      };
      img.onerror = () => resolve(item);
      img.src = url;
    });
  }
  if (item.kind === "pdf") {
    try {
      const { getPdfjs } = await import("@/lib/pdf-utils");
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: (await item.file.arrayBuffer()).slice(0) }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: 0.6 });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      await doc.destroy();
      return { ...item, thumb: c.toDataURL("image/jpeg", 0.7) };
    } catch {
      return item;
    }
  }
  return item;
}

export default function PrintPage() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [paperId, setPaperId] = useState("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [dpi, setDpi] = useState(600);
  const [customDpi, setCustomDpi] = useState(480);
  const [marginMm, setMarginMm] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFiles = useCallback(async (files: File[]) => {
    const valid = files.slice(0, 50);
    const next: FileItem[] = [];
    for (const f of valid) {
      const base: FileItem = {
        id: `f-${(uid += 1)}-${Date.now()}`,
        file: f,
        kind: kindOf(f),
        meta: fmtSize(f.size),
      };
      next.push(base);
    }
    setItems((prev) => [...prev, ...next]);
    // 异步补缩略图
    for (const it of next) {
      const withThumb = await makeThumb(it);
      setItems((prev) => prev.map((p) => (p.id === it.id ? withThumb : p)));
    }
  }, []);

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const print = async (ids?: string[]) => {
    setError("");
    const targets = ids ? items.filter((i) => ids.includes(i.id)) : items;
    if (targets.length === 0) {
      setError("请先上传要打印的文件");
      return;
    }
    setBusy(true);
    try {
      const actualDpi = dpi === 0 ? customDpi : dpi;
      const opts: PrintOptions = { paperId, orientation, dpi: actualDpi, marginMm };
      const htmls: string[] = [];
      for (const it of targets) {
        try {
          htmls.push(await renderPagesHtml(it, opts));
        } catch (e) {
          setError(`${it.file.name} 渲染失败：${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
      if (htmls.length > 0) {
        await printPages(htmls, opts);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="文件打印"
        lede="上传 PDF / 图片 / Word / 文本，预览后调用本机打印机直接打印"
        chip={<span><IconPrinter width={12} height={12} /> 本地打印 · 选本机打印机</span>}
      />

      <div className="single-panel">
        <FileDropZone
          label="拖入文件，或点击选择文件（PDF / 图片 / Word / 文本，最多 50 个）"
          accept=".pdf,.docx,.doc,.txt,.md,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onFiles={(f) => void onFiles(f)}
        />

        {items.length > 0 && (
          <div className="print-settings">
            <div className="tool-row" style={{ flexWrap: "wrap", gap: 8 }}>
              <label className="print-field">
                <span>纸张</span>
                <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} ({p.widthMm}×{p.heightMm}mm)</option>
                  ))}
                </select>
              </label>
              <label className="print-field">
                <span>方向</span>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}>
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select>
              </label>
              <label className="print-field">
                <span>清晰度</span>
                <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                  <option value={300}>300 DPI（标准）</option>
                  <option value={600}>600 DPI（高清 · 对齐主流打印机）</option>
                  <option value={1200}>1200 DPI（超清 · 大文件渲染较慢）</option>
                  <option value={0}>自定义…</option>
                </select>
                {dpi === 0 && (
                  <input
                    type="number" min={72} max={2400} step={50} value={customDpi}
                    onChange={(e) => setCustomDpi(Math.max(72, Number(e.target.value) || 72))}
                    placeholder="如 480 / 960"
                  />
                )}
              </label>
              <label className="print-field">
                <span>边距 mm</span>
                <input
                  type="number" min={0} max={40} value={marginMm}
                  onChange={(e) => setMarginMm(Math.max(0, Number(e.target.value)))}
                />
              </label>
              <span className="spacer" />
              <button
                className="btn btn-primary"
                onClick={() => void print()}
                disabled={busy}
                type="button"
              >
                {busy ? <IconLoader width={14} height={14} /> : <IconPrinter width={14} height={14} />}
                {busy ? "正在准备打印…" : "打印全部"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="err-text" style={{ marginTop: 10 }}>{error}</p>}

        {items.length > 0 && (
          <div className="print-list">
            {items.map((it) => (
              <div className="print-item" key={it.id}>
                <div className="print-item-thumb">
                  {it.thumb ? (
                    <img src={it.thumb} alt="" />
                  ) : (
                    <span className="print-item-ico">{it.kind === "word" ? "W" : it.kind === "text" ? "T" : "PDF"}</span>
                  )}
                </div>
                <div className="print-item-meta">
                  <div className="print-item-name">{it.file.name}</div>
                  <div className="print-item-sub">{KIND_LABEL[it.kind]} · {it.meta}</div>
                </div>
                <div className="print-item-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => void print([it.id])} disabled={busy} type="button">
                    {busy ? <IconLoader width={13} height={13} /> : <IconPrinter width={13} height={13} />}
                    打印
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(it.id)} type="button">
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="count-hint" style={{ marginTop: 10 }}>
          清晰度档位对齐打印机输出（600 / 1200 DPI 与主流打印机一致）；1200 DPI 渲染开销大，多页大 PDF 建议用 600。点击打印会弹出浏览器系统打印对话框，选择本机连接的打印机即可；文件在本地处理，不上传服务器。
        </p>
      </div>
    </div>
  );
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
