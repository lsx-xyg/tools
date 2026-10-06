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
  rotation: number; /* 当前旋转角度 0/90/180/270 */
  suggested: number | null; /* 智能检测建议角度 */
  status: "pending" | "rendering" | "ready" | "error";
  message?: string;
  blob?: Blob;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
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

/** 智能检测：横图竖页 / 竖图横页 → 建议旋转 90°（默认顺时针，用户可调整为 270°） */
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  /* 用 ref 存储每个文件的 pdf.js 文档和 canvas，避免 state 更新触发重渲染 */
  const pdfDocsRef = useRef<Map<string, import("pdfjs-dist").PDFDocumentProxy>>(new Map());
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    setLogs((prev) => [...prev, { time: now(), text, kind }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  /* ---------- 渲染单个文件的第一页 ---------- */
  const renderFile = useCallback(
    async (row: FileRow, rotation: number) => {
      if (!row.blob) return;
      const canvas = canvasesRef.current.get(row.name);
      if (!canvas) return;

      try {
        const pdfjs = await getPdfjs();
        let pdfDoc = pdfDocsRef.current.get(row.name);
        if (!pdfDoc) {
          const buf = await row.blob.arrayBuffer();
          pdfDoc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
          pdfDocsRef.current.set(row.name, pdfDoc);
        }
        const page = await pdfDoc.getPage(1);
        /* 用旋转后的 viewport 渲染，canvas 本身就是正的 */
        const viewport = page.getViewport({ scale: 1.5, rotation });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        setRows((prev) =>
          prev.map((r) => (r.name === row.name ? { ...r, status: "ready" as const } : r)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "渲染失败";
        setRows((prev) =>
          prev.map((r) => (r.name === row.name ? { ...r, status: "error" as const, message: msg } : r)),
        );
      }
    },
    [],
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
            return {
              name: p.name,
              size: p.blob.size,
              pages: doc.getPageCount(),
              rotation: 0,
              suggested: null,
              status: "pending" as const,
              blob: p.blob,
            };
          } catch {
            return {
              name: p.name,
              size: p.blob.size,
              pages: 0,
              rotation: 0,
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
        /* 逐个渲染预览 */
        for (const row of newRows) {
          renderFile(row, 0);
        }
      }
    },
    [log, renderFile],
  );

  const removeRow = (idx: number) => {
    const row = rows[idx];
    pdfDocsRef.current.delete(row.name);
    canvasesRef.current.delete(row.name);
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    pdfDocsRef.current.clear();
    canvasesRef.current.clear();
    setRows([]);
    setLogs([]);
  };

  /* ---------- 旋转单个文件 ---------- */
  const rotateFile = (name: string, delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name) return r;
        const newRot = (r.rotation + delta + 360) % 360;
        /* 延迟渲染，避免连续点击时重复渲染 */
        setTimeout(() => renderFile(r, newRot), 50);
        return { ...r, rotation: newRot, status: "rendering" as const };
      }),
    );
  };

  const resetFile = (name: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name) return r;
        setTimeout(() => renderFile(r, 0), 50);
        return { ...r, rotation: 0, status: "rendering" as const };
      }),
    );
  };

  /* ---------- 智能检测：批量设置建议角度 ---------- */
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
      setRows((prev) =>
        prev.map((r) =>
          r.name === row.name
            ? { ...r, suggested, rotation: suggested ?? r.rotation }
            : r,
        ),
      );
      /* 重新渲染 */
      if (suggested !== null) {
        const updated = { ...row, rotation: suggested };
        setTimeout(() => renderFile(updated, suggested), 50);
      }
    }
    log(`智能检测完成：${detected}/${rows.length} 个文件建议旋转（默认顺时针 90°，方向反了请点左旋调整）`, "ok");
    setBusy(false);
  };

  /* ---------- 批量操作 ---------- */
  const rotateAll = (delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "error") return r;
        const newRot = (r.rotation + delta + 360) % 360;
        setTimeout(() => renderFile(r, newRot), 50);
        return { ...r, rotation: newRot, status: "rendering" as const };
      }),
    );
  };

  const resetAll = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "error") return r;
        setTimeout(() => renderFile(r, 0), 50);
        return { ...r, rotation: 0, status: "rendering" as const };
      }),
    );
  };

  /* ---------- 下载 ---------- */
  const download = async () => {
    const valid = rows.filter((r) => r.status !== "error" && r.blob);
    if (valid.length === 0) return;
    setBusy(true);
    log(`开始生成 ${valid.length} 个 PDF…`, "info");

    const results: { name: string; blob: Blob }[] = [];
    for (const row of valid) {
      try {
        const buf = await row.blob!.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        const pages = doc.getPages();
        for (const page of pages) {
          page.setRotation(degrees(row.rotation));
        }
        const outBytes = await doc.save();
        const outBlob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        results.push({ name: row.name.replace(/\.pdf$/i, "_rotated.pdf"), blob: outBlob });
        log(`  ${row.name}：旋转至 ${row.rotation}°`, "ok");
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

  const rotatedCount = rows.filter((r) => r.rotation !== 0 && r.status !== "error").length;

  return (
    <div className="fade-rise">
      <ToolHead
        title="PDF 自动旋转"
        lede="上传 PDF 或压缩包，内置预览实时旋转 — 智能检测建议方向，手动微调确认后批量下载"
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
          <button className="btn" onClick={() => rotateAll(-90)} disabled={busy} title="全部逆时针 90°">
            <IconRotate width={16} height={16} />
            全部左旋
          </button>
          <button className="btn" onClick={() => rotateAll(90)} disabled={busy} title="全部顺时针 90°">
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
            下载{rows.length > 1 ? "打包" : ""}（{rotatedCount} 个已旋转）
          </button>
          <button className="btn btn-ghost" onClick={clearAll} disabled={busy}>
            <IconTrash width={16} height={16} />
            清空
          </button>
        </div>
      )}

      {/* 文件预览网格 */}
      {rows.length > 0 && (
        <div className="vc-preview-grid">
          {rows.map((row, i) => (
            <div key={`${row.name}-${i}`} className={`vc-preview-card ${row.rotation !== 0 ? "vc-rotated" : ""}`}>
              {/* 预览区 */}
              <div className="vc-preview-area">
                {row.status === "error" ? (
                  <div className="vc-preview-error">
                    <IconX width={24} height={24} />
                    <span>{row.message || "解析失败"}</span>
                  </div>
                ) : (
                  <div className="vc-preview-canvas-wrap">
                    <canvas
                      ref={(el) => {
                        if (el) canvasesRef.current.set(row.name, el);
                      }}
                      className="vc-preview-canvas"
                    />
                    {row.status === "rendering" && (
                      <div className="vc-preview-loading">
                        <IconLoader width={20} height={20} className="spin" />
                      </div>
                    )}
                  </div>
                )}
                {/* 角度标签 */}
                {row.rotation !== 0 && (
                  <span className="vc-rotation-badge">{row.rotation}°</span>
                )}
                {row.suggested !== null && row.rotation === row.suggested && (
                  <span className="vc-suggested-badge">智能建议</span>
                )}
              </div>

              {/* 信息区 */}
              <div className="vc-preview-info">
                <div className="vc-preview-name" title={row.name}>
                  <IconFile width={14} height={14} />
                  <span>{row.name}</span>
                </div>
                <div className="vc-preview-meta">
                  {row.pages} 页 · {fmtSize(row.size)}
                </div>

                {/* 旋转控制 */}
                {row.status !== "error" && (
                  <div className="vc-preview-controls">
                    <button
                      className="vc-ctrl-btn"
                      onClick={() => rotateFile(row.name, -90)}
                      title="逆时针 90°"
                      disabled={busy}
                    >
                      <IconRotate width={16} height={16} />
                    </button>
                    <button
                      className="vc-ctrl-btn"
                      onClick={() => rotateFile(row.name, 90)}
                      title="顺时针 90°"
                      disabled={busy}
                    >
                      <IconRotateCw width={16} height={16} />
                    </button>
                    <button
                      className="vc-ctrl-btn"
                      onClick={() => rotateFile(row.name, 180)}
                      title="旋转 180°"
                      disabled={busy}
                    >
                      <IconRotateCw width={16} height={16} style={{ transform: "rotate(90deg)" }} />
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-reset"
                      onClick={() => resetFile(row.name)}
                      title="重置为 0°"
                      disabled={busy || row.rotation === 0}
                    >
                      <IconRefresh width={16} height={16} />
                    </button>
                    <button
                      className="vc-ctrl-btn vc-ctrl-del"
                      onClick={() => removeRow(i)}
                      title="移除"
                      disabled={busy}
                    >
                      <IconX width={16} height={16} />
                    </button>
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
        所有处理在浏览器本地完成，PDF 不上传服务器。上传后点击「智能检测」自动分析内部图片宽高比并设置建议方向（横图竖页默认顺时针 90°）；
        每个文件可实时预览，方向不对就点左旋/右旋/180° 调整，确认后批量下载。智能检测无法区分顺时针 90° 和逆时针 270°，也无法检测竖向图片内容侧躺的情况，需手动微调。
      </div>
    </div>
  );
}
