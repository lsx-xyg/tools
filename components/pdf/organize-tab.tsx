"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconFileStack,
  IconLoader,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import { downloadBytes, getPdfjs, organizePdf, pdfError, pdfPages } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfViewerModal } from "@/components/pdf/pdf-file-list";

export function OrganizeTab() {
  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer; pages: number } | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [viewer, setViewer] = useState<{ pageIndex: number } | null>(null);
  const thumbsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  const addFile = async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
    if (!f) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    try {
      const bytes = await f.arrayBuffer();
      const pages = await pdfPages(bytes);
      setFile({ name: f.name, bytes, pages });
      setOrder(Array.from({ length: pages }, (_, i) => i));
      setDeleted(new Set());
      setViewer(null);
    } catch (e) {
      setErr(pdfError(e));
    }
  };

  /* 渲染缩略图 */
  const renderThumbs = useCallback(async () => {
    if (!file) return;
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: file.bytes.slice(0) }).promise;
      docRef.current = doc;
      for (let i = 1; i <= doc.numPages; i += 1) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = thumbsRef.current.get(i - 1);
        if (!canvas) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch {
      /* 缩略图失败不阻塞 */
    }
  }, [file]);

  useEffect(() => {
    if (file && order.length) void renderThumbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const toggleDelete = (idx: number) => {
    setDeleted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const move = (pos: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const j = pos + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[pos], next[j]] = [next[j], next[pos]];
      return next;
    });
  };

  const removeDeleted = () => {
    setOrder((prev) => prev.filter((i) => !deleted.has(i)));
    setDeleted(new Set());
  };

  async function apply() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const kept = order.filter((i) => !deleted.has(i));
      if (kept.length === 0) {
        setErr("至少保留 1 页");
        setBusy(false);
        return;
      }
      const out = await organizePdf(file.bytes, kept);
      downloadBytes(out, file.name.replace(/\.pdf$/i, "-organized.pdf"));
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy(false);
    }
  }

  const keptCount = order.filter((i) => !deleted.has(i)).length;

  return (
    <div className="single-panel tab-anim">
      <FileDropZone
        accept="application/pdf,.pdf"
        icon={<IconPlus width={18} height={18} />}
        label={file ? `已选择：${file.name}` : "拖入 PDF，或点击选择文件"}
        onFiles={(files) => void addFile(files)}
      />

      {file && (
        <>
          <p className="count-hint" style={{ marginTop: 12 }}>
            原 {file.pages} 页 · 保留 {keptCount} 页 · 标记删除 {deleted.size} 页
          </p>
          <div className="pfl-page-grid">
            {order.map((origIdx, pos) => {
              const isDel = deleted.has(origIdx);
              return (
                <div key={origIdx} className={`pfl-page-card${isDel ? " pfl-del-mark" : ""}`}>
                  <div
                    className="pfl-page-thumb"
                    title="点击放大预览"
                    onClick={() => setViewer({ pageIndex: origIdx })}
                  >
                    <canvas
                      ref={(el) => {
                        if (el) thumbsRef.current.set(origIdx, el);
                      }}
                      className="pfl-page-canvas"
                    />
                  </div>
                  <div className="pfl-page-meta">
                    <span className="pfl-page-name">第 {origIdx + 1} 页</span>
                    <div className="pfl-page-actions">
                      <button type="button" className="vc-icon-btn" onClick={() => move(pos, -1)} title="上移" disabled={busy || pos === 0}>
                        <IconArrowUp width={14} height={14} />
                      </button>
                      <button type="button" className="vc-icon-btn" onClick={() => move(pos, 1)} title="下移" disabled={busy || pos === order.length - 1}>
                        <IconArrowDown width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        className="vc-icon-btn pfl-del"
                        onClick={() => toggleDelete(origIdx)}
                        title={isDel ? "取消删除" : "标记删除"}
                        disabled={busy}
                        style={isDel ? { color: "var(--err)" } : undefined}
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tool-row" style={{ marginTop: 14 }}>
            <span className="count-hint">勾选要删除的页，或用 ↑↓ 调整顺序</span>
            <span className="spacer" />
            <button className="btn btn-ghost" onClick={removeDeleted} type="button" disabled={busy || deleted.size === 0}>
              <IconTrash width={15} height={15} />
              删除选中页
            </button>
            <button className="btn btn-primary" onClick={() => void apply()} type="button" disabled={busy}>
              {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
              {busy ? "处理中…" : "应用顺序并下载"}
            </button>
          </div>
        </>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      {file && (
        <PdfViewerModal
          open={!!viewer}
          onClose={() => setViewer(null)}
          title={file.name}
          kind="pdf"
          bytes={file.bytes}
          pageCount={file.pages}
          pageIndex={viewer?.pageIndex ?? 0}
          onPageChange={(i) => setViewer({ pageIndex: i })}
          rotation={0}
        />
      )}
    </div>
  );
}
