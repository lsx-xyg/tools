"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import {
  IconUpload,
  IconTrash,
  IconLoader,
  IconRotate,
  IconRotateCw,
  IconDownload,
  IconFile,
  IconX,
  IconRefresh,
  IconBolt,
} from "@/components/icons";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";

/* ---------- 类型 ---------- */
interface FileRow {
  name: string;
  size: number;
  pages: number;
  rotations: number[]; /* 每页当前旋转角度 0/90/180/270 */
  suggested: number | null; /* 智能检测建议角度 */
  status: "pending" | "rendering" | "ready" | "error";
  message?: string;
  blob?: Blob;
}

interface LogLine {
  time: string;
  text: string;
  kind: "info" | "ok" | "warn" | "err";
}

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
};

/* ---------- PDF 字节级分析：检测页面尺寸和内部图片尺寸 ---------- */
function getPageSizeFromBytes(bytes: ArrayBuffer): { w: number; h: number } {
  const s = new TextDecoder("latin1").decode(bytes);
  const m = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (m) return { w: parseFloat(m[3]) - parseFloat(m[1]), h: parseFloat(m[4]) - parseFloat(m[2]) };
  return { w: 595, h: 842 };
}

function getImageDimsFromBytes(bytes: ArrayBuffer): { w: number; h: number } | null {
  const s = new TextDecoder("latin1").decode(bytes);
  const m1 = s.match(/\/Width\s+(\d+)[\s\S]{0,500}?\/Height\s+(\d+)/);
  if (m1) return { w: parseInt(m1[1], 10), h: parseInt(m1[2], 10) };
  const m2 = s.match(/\/Height\s+(\d+)[\s\S]{0,500}?\/Width\s+(\d+)/);
  if (m2) return { w: parseInt(m2[2], 10), h: parseInt(m2[1], 10) };
  return null;
}

/** 智能检测：横图竖页 / 竖图横页 → 建议旋转 90°（默认顺时针，方向反了手动左旋调整） */
function detectSuggestedRotation(bytes: ArrayBuffer): number | null {
  const page = getPageSizeFromBytes(bytes);
  const img = getImageDimsFromBytes(bytes);
  if (!img) return null;
  const pageOrient = page.h > page.w ? "portrait" : "landscape";
  const imgOrient = img.h > img.w ? "portrait" : "landscape";
  if (pageOrient !== imgOrient) return 90;
  return null;
}

/* ---------- pdf.js 懒加载 ---------- */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

export default function PdfAutoRotatePage() {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [dragging, setDragging] = useState(false);
  /* 大预览模态：点击缩略图打开，viewer 为当前查看的文件与页码 */
  const [viewer, setViewer] = useState<{ name: string; pageIndex: number } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const viewCanvasRef = useRef<HTMLCanvasElement>(null);
  /* ref 存储 pdf.js 文档和 canvas（key: 文件名#页码），避免 setState 重渲染 */
  const pdfDocsRef = useRef<Map<string, import("pdfjs-dist").PDFDocumentProxy>>(new Map());
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  /* 每页正在进行的渲染任务，新渲染启动时先 cancel 旧的，避免 canvas 冲突 */
  const renderTasksRef = useRef<Map<string, import("pdfjs-dist").RenderTask>>(new Map());

  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    setLogs((prev) => [...prev, { time: now(), text, kind }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  /* Esc 关闭大预览 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- 通用渲染：任意 canvas 渲染一页（缩略图与大预览共用） ---------- */
  const renderPageToCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
      row: FileRow,
      pageIndex: number,
      rotation: number,
      scale: number,
      kind: "t" | "v",
    ) => {
      const key = `${kind}:${row.name}#${pageIndex}`;
      /* 取消同 key 旧的渲染任务，避免同一 canvas 并发渲染冲突 */
      const oldTask = renderTasksRef.current.get(key);
      if (oldTask) {
        try {
          oldTask.cancel();
        } catch {
          /* ignore */
        }
      }
      try {
        const pdfjs = await getPdfjs();
        let pdfDoc = pdfDocsRef.current.get(row.name);
        if (!pdfDoc) {
          const buf = await row.blob!.arrayBuffer();
          pdfDoc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
          pdfDocsRef.current.set(row.name, pdfDoc);
        }
        const page = await pdfDoc.getPage(pageIndex + 1);
        /* 用旋转后的 viewport 渲染，canvas 本身就是正的 */
        const viewport = page.getViewport({ scale, rotation });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        const task = page.render({ canvasContext: ctx, viewport });
        renderTasksRef.current.set(key, task);
        await task.promise;
        /* 仅当引用未变时清理，避免误删新任务的记录 */
        if (renderTasksRef.current.get(key) === task) renderTasksRef.current.delete(key);
        page.cleanup();
      } catch (e) {
        /* 被新渲染任务取消不算错误 */
        if (e instanceof Error && /cancel/i.test(e.message)) return;
        throw e;
      }
    },
    [],
  );

  /* viewer 变化（打开/翻页/旋转）时渲染大预览，高分辨率保证文字清晰 */
  useEffect(() => {
    if (!viewer) return;
    const row = rows.find((r) => r.name === viewer.name);
    const canvas = viewCanvasRef.current;
    if (!row || !canvas || row.status === "error" || !row.blob) return;
    setViewLoading(true);
    renderPageToCanvas(canvas, row, viewer.pageIndex, row.rotations[viewer.pageIndex] ?? 0, 2.2, "v")
      .catch(() => {
        /* 大预览渲染失败：保持静默，由 loading 遮罩消失即可 */
      })
      .finally(() => setViewLoading(false));
  }, [viewer, rows, renderPageToCanvas]);

  /* ---------- 渲染缩略图单页 ---------- */
  const renderPage = useCallback(
    async (row: FileRow, pageIndex: number, rotation: number) => {
      const key = `${row.name}#${pageIndex}`;
      const canvas = canvasesRef.current.get(key);
      if (!canvas || !row.blob) return;
      try {
        await renderPageToCanvas(canvas, row, pageIndex, rotation, 1.2, "t");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "渲染失败";
        setRows((prev) =>
          prev.map((r) =>
            r.name === row.name ? { ...r, status: "error" as const, message: msg } : r,
          ),
        );
      }
    },
    [renderPageToCanvas],
  );

  /* ---------- 渲染文件的所有页 ---------- */
  const renderAllPages = useCallback(
    async (row: FileRow) => {
      if (!row.blob) return;
      setRows((prev) =>
        prev.map((r) => (r.name === row.name ? { ...r, status: "rendering" as const } : r)),
      );
      for (let i = 0; i < row.pages; i++) {
        await renderPage(row, i, row.rotations[i] ?? 0);
      }
      setRows((prev) =>
        prev.map((r) => (r.name === row.name ? { ...r, status: "ready" as const } : r)),
      );
    },
    [renderPage],
  );

  /* ---------- 解析上传文件（支持 zip） ---------- */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const pdfs: { name: string; blob: Blob }[] = [];

      for (const f of arr) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          try {
            const zip = await JSZip.loadAsync(f);
            let count = 0;
            for (const [name, entry] of Object.entries(zip.files)) {
              if (!entry.dir && name.toLowerCase().endsWith(".pdf")) {
                const blob = await entry.async("blob");
                pdfs.push({ name: name.split("/").pop() || name, blob });
                count++;
              }
            }
            log(`从压缩包 ${f.name} 中提取 ${count} 个 PDF`, "ok");
          } catch {
            log(`压缩包 ${f.name} 解析失败`, "err");
          }
        } else if (f.name.toLowerCase().endsWith(".pdf")) {
          pdfs.push({ name: f.name, blob: f });
        }
      }

      const newRows: FileRow[] = await Promise.all(
        pdfs.map(async (p) => {
          try {
            const buf = await p.blob.arrayBuffer();
            const doc = await PDFDocument.load(buf);
            const count = doc.getPageCount();
            return {
              name: p.name,
              size: p.blob.size,
              pages: count,
              rotations: Array(count).fill(0),
              suggested: null,
              status: "pending" as const,
              blob: p.blob,
            };
          } catch {
            return {
              name: p.name,
              size: p.blob.size,
              pages: 0,
              rotations: [],
              suggested: null,
              status: "error" as const,
              message: "PDF 解析失败",
              blob: p.blob,
            };
          }
        }),
      );

      setRows((prev) => [...prev, ...newRows]);
      if (newRows.length) {
        log(`已添加 ${newRows.length} 个 PDF`, "ok");
        for (const row of newRows) {
          renderAllPages(row);
        }
      }
    },
    [log, renderAllPages],
  );

  const removeRow = (name: string) => {
    pdfDocsRef.current.delete(name);
    const row = rows.find((r) => r.name === name);
    if (row) {
      for (let i = 0; i < row.pages; i++) canvasesRef.current.delete(`${name}#${i}`);
    }
    setRows((prev) => prev.filter((r) => r.name !== name));
  };

  const clearAll = () => {
    pdfDocsRef.current.clear();
    canvasesRef.current.clear();
    setRows([]);
    setLogs([]);
  };

  /* ---------- 旋转单页 ---------- */
  const rotatePage = (name: string, pageIndex: number, delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name) return r;
        const rotations = [...r.rotations];
        rotations[pageIndex] = (rotations[pageIndex] + delta + 360) % 360;
        const updated = { ...r, rotations };
        setTimeout(() => renderPage(updated, pageIndex, rotations[pageIndex]), 50);
        return updated;
      }),
    );
  };

  const resetPage = (name: string, pageIndex: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name) return r;
        const rotations = [...r.rotations];
        rotations[pageIndex] = 0;
        const updated = { ...r, rotations };
        setTimeout(() => renderPage(updated, pageIndex, 0), 50);
        return updated;
      }),
    );
  };

  /* ---------- 旋转文件的全部页 ---------- */
  const rotateFilePages = (name: string, delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name || r.status === "error") return r;
        const rotations = r.rotations.map((x) => (x + delta + 360) % 360);
        const updated = { ...r, rotations };
        setTimeout(() => renderAllPages(updated), 50);
        return updated;
      }),
    );
  };

  const resetFilePages = (name: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name || r.status === "error") return r;
        const updated = { ...r, rotations: Array(r.pages).fill(0) };
        setTimeout(() => renderAllPages(updated), 50);
        return updated;
      }),
    );
  };

  /* ---------- 智能检测：批量设置建议角度（应用到全部页） ---------- */
  const smartDetect = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    log("开始智能检测（分析内部图片宽高比）…", "info");
    let detected = 0;
    for (const row of rows) {
      if (!row.blob || row.status === "error") continue;
      const buf = await row.blob.arrayBuffer();
      const suggested = detectSuggestedRotation(buf);
      if (suggested !== null) {
        detected++;
        const page = getPageSizeFromBytes(buf);
        const img = getImageDimsFromBytes(buf);
        log(
          `  ${row.name}：页面 ${Math.round(page.w)}x${Math.round(page.h)}（${page.h > page.w ? "竖" : "横"}版），` +
            `图片 ${img?.w}x${img?.h}（${img && img.h > img.w ? "竖" : "横"}向）→ 建议旋转 ${suggested}°`,
          "info",
        );
      }
      const updated: FileRow = {
        ...row,
        suggested,
        rotations: suggested !== null ? Array(row.pages).fill(suggested) : row.rotations,
      };
      setRows((prev) => prev.map((r) => (r.name === row.name ? updated : r)));
      if (suggested !== null) {
        setTimeout(() => renderAllPages(updated), 50);
      }
    }
    log(
      `智能检测完成：${detected}/${rows.length} 个文件建议旋转（默认顺时针 90°，方向反了请点左旋调整；每页可单独微调）`,
      "ok",
    );
    setBusy(false);
  };

  /* ---------- 全局批量操作 ---------- */
  const rotateAll = (delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "error") return r;
        const rotations = r.rotations.map((x) => (x + delta + 360) % 360);
        const updated = { ...r, rotations };
        setTimeout(() => renderAllPages(updated), 50);
        return updated;
      }),
    );
  };

  const resetAll = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "error") return r;
        const updated = { ...r, rotations: Array(r.pages).fill(0) };
        setTimeout(() => renderAllPages(updated), 50);
        return updated;
      }),
    );
  };

  /* ---------- 按当前角度生成单个 PDF ---------- */
  const buildRotatedBlob = useCallback(async (row: FileRow) => {
    const buf = await row.blob!.arrayBuffer();
    const doc = await PDFDocument.load(buf);
    const pages = doc.getPages();
    pages.forEach((page, i) => {
      const rot = row.rotations[i] ?? 0;
      if (rot) page.setRotation(degrees(rot));
    });
    const outBytes = await doc.save();
    return new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  }, []);

  /* ---------- 下载单个文件 ---------- */
  const downloadOne = async (name: string) => {
    const row = rows.find((r) => r.name === name);
    if (!row || row.status === "error" || !row.blob) return;
    setBusy(true);
    try {
      const blob = await buildRotatedBlob(row);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.name.replace(/\.pdf$/i, "_rotated.pdf");
      a.click();
      URL.revokeObjectURL(url);
      log(`已下载 ${row.name.replace(/\.pdf$/i, "_rotated.pdf")}`, "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "处理失败";
      log(`  ${row.name}：${msg}`, "err");
    }
    setBusy(false);
  };

  /* ---------- 下载（逐页按各自角度） ---------- */
  const download = async () => {
    const valid = rows.filter((r) => r.status !== "error" && r.blob);
    if (valid.length === 0) return;
    setBusy(true);
    log(`开始生成 ${valid.length} 个 PDF…`, "info");

    const results: { name: string; blob: Blob }[] = [];
    for (const row of valid) {
      try {
        const outBlob = await buildRotatedBlob(row);
        results.push({ name: row.name.replace(/\.pdf$/i, "_rotated.pdf"), blob: outBlob });
        const rotatedPages = row.rotations.filter((x) => x !== 0).length;
        log(
          `  ${row.name}：${row.pages} 页中旋转 ${rotatedPages} 页（${row.rotations.join("/")}°）`,
          "ok",
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "处理失败";
        log(`  ${row.name}：${msg}`, "err");
      }
    }

    if (results.length === 1) {
      const url = URL.createObjectURL(results[0].blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = results[0].name;
      a.click();
      URL.revokeObjectURL(url);
      log(`已下载 ${results[0].name}`, "ok");
    } else if (results.length > 1) {
      const zip = new JSZip();
      for (const r of results) zip.file(r.name, r.blob);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pdf_rotated.zip";
      a.click();
      URL.revokeObjectURL(url);
      log(`已打包下载 ${results.length} 个 PDF`, "ok");
    }
    setBusy(false);
  };

  const totalRotatedPages = rows.reduce(
    (acc, r) => acc + r.rotations.filter((x) => x !== 0).length,
    0,
  );

  return (
    <div className="fade-rise">
      <ToolHead
        title="PDF 自动旋转"
        lede="上传 PDF 或压缩包，单页拼接预览全部文件 — 每页可独立旋转，确认后批量下载"
        chip={
          <span>
            <IconRotate width={12} height={12} />
            本地处理 · 隐私安全
          </span>
        }
      />

      {/* 上传区 */}
      <div
        className={`vd-dropzone ${dragging ? "vd-dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload width={22} height={22} />
        <span>点击或拖拽 PDF / ZIP 到此处（可多选）</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.zip"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* 工具栏 */}
      {rows.length > 0 && (
        <div className="vc-toolbar">
          <button className="btn btn-primary" onClick={smartDetect} disabled={busy}>
            <IconBolt width={16} height={16} />
            智能检测
          </button>
          <div className="vc-toolbar-divider" />
          <button className="btn" onClick={() => rotateAll(-90)} disabled={busy} title="全部页逆时针 90°">
            <IconRotate width={16} height={16} />
            全部左旋
          </button>
          <button className="btn" onClick={() => rotateAll(90)} disabled={busy} title="全部页顺时针 90°">
            <IconRotateCw width={16} height={16} />
            全部右旋
          </button>
          <button className="btn btn-ghost" onClick={resetAll} disabled={busy}>
            <IconRefresh width={16} height={16} />
            全部重置
          </button>
          <div className="vc-toolbar-divider" />
          <button className="btn btn-success" onClick={download} disabled={busy || rows.length === 0}>
            <IconDownload width={16} height={16} />
            下载{rows.length > 1 ? "打包" : ""}（{totalRotatedPages} 页已旋转）
          </button>
          <button className="btn btn-ghost" onClick={clearAll} disabled={busy}>
            <IconTrash width={16} height={16} />
            清空
          </button>
        </div>
      )}

      {/* 拼接式预览：文件名顶部 + 全部页预览，文件之间依次拼接 */}
      {rows.length > 0 && (
        <div className="vc-stack">
          {rows.map((row, i) => (
            <div key={`${row.name}-${i}`} className="vc-file-block">
              {/* 文件头 */}
              <div className="vc-file-head">
                <div className="vc-file-head-left">
                  <IconFile width={15} height={15} />
                  <span className="vc-file-name" title={row.name}>
                    {row.name}
                  </span>
                  <span className="vc-file-meta">
                    {row.pages} 页 · {fmtSize(row.size)}
                  </span>
                  {row.suggested !== null && (
                    <span className="vc-suggested-badge">建议 {row.suggested}°</span>
                  )}
                  {row.rotations.some((x) => x !== 0) && (
                    <span className="vc-rotated-badge">已旋转</span>
                  )}
                </div>
                <div className="vc-file-head-actions">
                  <button
                    className="vc-ctrl-btn vc-ctrl-sm"
                    onClick={() => rotateFilePages(row.name, -90)}
                    disabled={busy || row.status === "error"}
                    title="本文件全部页左旋 90°"
                  >
                    <IconRotate width={14} height={14} />
                    左旋
                  </button>
                  <button
                    className="vc-ctrl-btn vc-ctrl-sm"
                    onClick={() => rotateFilePages(row.name, 90)}
                    disabled={busy || row.status === "error"}
                    title="本文件全部页右旋 90°"
                  >
                    <IconRotateCw width={14} height={14} />
                    右旋
                  </button>
                  <button
                    className="vc-ctrl-btn vc-ctrl-sm"
                    onClick={() => resetFilePages(row.name)}
                    disabled={busy || row.status === "error"}
                    title="本文件全部页重置为 0°"
                  >
                    <IconRefresh width={14} height={14} />
                    重置
                  </button>
                  <button
                    className="vc-ctrl-btn vc-ctrl-sm vc-ctrl-del"
                    onClick={() => removeRow(row.name)}
                    disabled={busy}
                    title="移除文件"
                  >
                    <IconX width={14} height={14} />
                  </button>
                </div>
              </div>

              {/* 文件内容：全部页缩略图 */}
              <div className="vc-file-body">
                {row.status === "error" ? (
                  <div className="vc-preview-error">
                    <IconX width={24} height={24} />
                    <span>{row.message || "解析失败"}</span>
                  </div>
                ) : (
                  <div className="vc-pages">
                    {Array.from({ length: row.pages }).map((_, pi) => (
                      <div
                        key={pi}
                        className={`vc-page-thumb ${row.rotations[pi] ? "vc-rotated" : ""}`}
                      >
                        <div
                          className="vc-page-thumb-area"
                          onClick={() => setViewer({ name: row.name, pageIndex: pi })}
                          title="点击放大预览"
                        >
                          <canvas
                            ref={(el) => {
                              if (el) canvasesRef.current.set(`${row.name}#${pi}`, el);
                            }}
                            className="vc-page-canvas"
                          />
                          {row.status === "rendering" && (
                            <div className="vc-page-loading">
                              <IconLoader width={18} height={18} className="spin" />
                            </div>
                          )}
                          {row.rotations[pi] !== 0 && (
                            <span className="vc-rotation-badge">{row.rotations[pi]}°</span>
                          )}
                          <span className="vc-page-num">第 {pi + 1} 页</span>
                        </div>
                        <div className="vc-page-ctrls">
                          <button
                            className="vc-ctrl-btn"
                            onClick={() => rotatePage(row.name, pi, -90)}
                            disabled={busy}
                            title="本页左旋 90°"
                          >
                            <IconRotate width={14} height={14} />
                          </button>
                          <button
                            className="vc-ctrl-btn"
                            onClick={() => rotatePage(row.name, pi, 90)}
                            disabled={busy}
                            title="本页右旋 90°"
                          >
                            <IconRotateCw width={14} height={14} />
                          </button>
                          <button
                            className="vc-ctrl-btn vc-ctrl-reset"
                            onClick={() => resetPage(row.name, pi)}
                            disabled={busy || row.rotations[pi] === 0}
                            title="本页重置为 0°"
                          >
                            <IconRefresh width={14} height={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 日志 */}
      {logs.length > 0 && (
        <div className="panel vc-log-panel-inline">
          <div className="panel-head">
            <span className="label">运行日志</span>
            <span className="right subtle">{logs.length} 条</span>
          </div>
          <div className="panel-body vc-log-body">
            <div className="vc-log-list">
              {logs.map((l, i) => (
                <div key={i} className={`vc-log-line vc-log-${l.kind}`}>
                  <span className="vc-log-time">{l.time}</span>
                  <span className="vc-log-text">{l.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      <div className="vc-footer">
        <strong>使用说明：</strong>
        所有处理在浏览器本地完成，PDF 不上传服务器。上传后点击「智能检测」自动分析内部图片宽高比并给横图竖页的文件建议旋转方向；
        页面按「文件名 → 全部页预览 → 下一个文件」纵向拼接展示，每个文件块顶部有整文件旋转按钮，每页缩略图下方有单页左旋/右旋/重置按钮，可单独调整任一页；
        <strong>点击任一页缩略图可放大预览</strong>（支持翻页、旋转、下载当前文件）；
        确认后批量下载（逐页按各自角度输出）。
      </div>

      {/* 大预览模态：点击缩略图打开，像浏览器直接查看 PDF */}
      {viewer &&
        (() => {
          const row = rows.find((r) => r.name === viewer.name);
          if (!row) return null;
          const pi = viewer.pageIndex;
          const rot = row.rotations[pi] ?? 0;
          const hasPrev = pi > 0;
          const hasNext = pi < row.pages - 1;
          return (
            <div
              className="vc-viewer"
              role="dialog"
              aria-modal="true"
              onClick={() => setViewer(null)}
            >
              <div
                className="vc-viewer-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="vc-viewer-head">
                  <div className="vc-viewer-title">
                    <IconFile width={16} height={16} />
                    <span className="vc-viewer-name" title={row.name}>
                      {row.name}
                    </span>
                    <span className="vc-viewer-meta">
                      {pi + 1} / {row.pages} 页
                    </span>
                    {rot !== 0 && <span className="vc-rotation-badge-static">{rot}°</span>}
                  </div>
                  <div className="vc-viewer-actions">
                    <button
                      className="vc-ctrl-btn vc-ctrl-sm"
                      onClick={() => rotatePage(row.name, pi, -90)}
                      disabled={busy}
                      title="本页左旋 90°"
                    >
                      <IconRotate width={14} height={14} />
                      左旋
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-sm"
                      onClick={() => rotatePage(row.name, pi, 90)}
                      disabled={busy}
                      title="本页右旋 90°"
                    >
                      <IconRotateCw width={14} height={14} />
                      右旋
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-sm"
                      onClick={() => resetPage(row.name, pi)}
                      disabled={busy || rot === 0}
                      title="本页重置为 0°"
                    >
                      <IconRefresh width={14} height={14} />
                      重置
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-sm"
                      onClick={() => downloadOne(row.name)}
                      disabled={busy}
                      title="下载当前文件（按当前角度）"
                    >
                      <IconDownload width={14} height={14} />
                      下载
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-sm vc-viewer-close"
                      onClick={() => setViewer(null)}
                      title="关闭（Esc）"
                    >
                      <IconX width={14} height={14} />
                      关闭
                    </button>
                  </div>
                </div>
                <div className="vc-viewer-body">
                  {hasPrev && (
                    <button
                      className="vc-viewer-nav"
                      onClick={() =>
                        setViewer({ name: row.name, pageIndex: pi - 1 })
                      }
                      title="上一页"
                    >
                      ‹
                    </button>
                  )}
                  <div className="vc-viewer-canvas-wrap">
                    <canvas ref={viewCanvasRef} className="vc-viewer-canvas" />
                    {viewLoading && (
                      <div className="vc-viewer-loading">
                        <IconLoader width={28} height={28} className="spin" />
                      </div>
                    )}
                  </div>
                  {hasNext && (
                    <button
                      className="vc-viewer-nav"
                      onClick={() =>
                        setViewer({ name: row.name, pageIndex: pi + 1 })
                      }
                      title="下一页"
                    >
                      ›
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
