"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import {
  IconUpload,
  IconTrash,
  IconLoader,
  IconRotate,
  IconEye,
  IconDownload,
  IconFile,
  IconX,
} from "@/components/icons";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";

/* tesseract 全局类型由 ocr 页面声明；此处用 any 断言扩展 OSD 能力 */
type TesseractWorker = {
  recognize: (image: Blob | HTMLCanvasElement) => Promise<{
    data: { text: string; orientationDegrees?: number; orientationConfidence?: number };
  }>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};
type TesseractGlobal = {
  createWorker: (
    langs: string,
    oem: number,
    opts: { workerPath?: string; corePath?: string; langPath?: string; logger?: (m: { status: string; progress: number }) => void },
  ) => Promise<TesseractWorker>;
};

/* ---------- 类型 ---------- */
type Mode = "smart" | "deep" | "manual";

interface FileRow {
  name: string;
  size: number;
  pages: number;
  rotated: number;
  status: "pending" | "processing" | "done" | "error";
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

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`加载脚本失败：${src}`));
    document.head.appendChild(s);
  });

/* ---------- PDF 字节级分析：检测页面尺寸和内部图片尺寸 ---------- */
function getPageSizeFromBytes(bytes: ArrayBuffer): { w: number; h: number } {
  const s = new TextDecoder("latin1").decode(bytes);
  const m = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (m) return { w: parseFloat(m[3]) - parseFloat(m[1]), h: parseFloat(m[4]) - parseFloat(m[2]) };
  return { w: 595, h: 842 };
}

function getImageDimsFromBytes(bytes: ArrayBuffer): { w: number; h: number } | null {
  const s = new TextDecoder("latin1").decode(bytes);
  /* 匹配 /Width N ... /Height N（Image XObject 常见顺序） */
  const m1 = s.match(/\/Width\s+(\d+)[\s\S]{0,500}?\/Height\s+(\d+)/);
  if (m1) return { w: parseInt(m1[1], 10), h: parseInt(m1[2], 10) };
  /* 反向顺序 */
  const m2 = s.match(/\/Height\s+(\d+)[\s\S]{0,500}?\/Width\s+(\d+)/);
  if (m2) return { w: parseInt(m2[2], 10), h: parseInt(m2[1], 10) };
  return null;
}

/** 检测图片方向与页面方向是否不一致（横图竖页 / 竖图横页），返回需要旋转的角度（90 或 null） */
function detectImageRotation(bytes: ArrayBuffer): number | null {
  const page = getPageSizeFromBytes(bytes);
  const img = getImageDimsFromBytes(bytes);
  if (!img) return null;
  const pageOrient = page.h > page.w ? "portrait" : "landscape";
  const imgOrient = img.h > img.w ? "portrait" : "landscape";
  if (pageOrient !== imgOrient) return 90; /* 默认顺时针 90°；若方向反了可用手动模式选 270° */
  return null;
}

export default function PdfAutoRotatePage() {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [mode, setMode] = useState<Mode>("smart");
  const [manualAngle, setManualAngle] = useState<number>(90);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    setLogs((prev) => [...prev, { time: now(), text, kind }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

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
              rotated: 0,
              status: "pending" as const,
              blob: p.blob,
            };
          } catch {
            return {
              name: p.name,
              size: p.blob.size,
              pages: 0,
              rotated: 0,
              status: "error" as const,
              message: "PDF 解析失败",
              blob: p.blob,
            };
          }
        }),
      );

      setRows((prev) => [...prev, ...newRows]);
      if (newRows.length) log(`已添加 ${newRows.length} 个 PDF`, "ok");
    },
    [log],
  );

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setRows([]);
    setLogs([]);
    setProgress(0);
  };

  /* ---------- pdf.js 渲染单页为 blob ---------- */
  const renderPageToBlob = async (
    pdfjsLib: typeof import("pdfjs-dist"),
    pdfDoc: import("pdfjs-dist").PDFDocumentProxy,
    pageNum: number,
  ): Promise<Blob> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  };

  /* ---------- 主处理流程 ---------- */
  const run = async () => {
    if (busy || rows.length === 0) return;
    cancelRef.current = false;
    setBusy(true);
    setProgress(0);
    setLogs([]);
    const modeLabel = mode === "smart" ? "智能（/Rotate + 图片方向检测）" : mode === "deep" ? "深度（智能 + OCR 文字方向）" : `手动（旋转至 ${manualAngle}°）`;
    log(`开始处理（模式：${modeLabel}）`, "info");

    let pdfjsLib: typeof import("pdfjs-dist") | null = null;
    let tesseractWorker: TesseractWorker | null = null;

    try {
      /* 深度模式：预加载 pdf.js + tesseract OSD */
      if (mode === "deep") {
        log("正在加载 PDF 渲染引擎…", "info");
        pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        log("正在加载 OCR 方向检测引擎…", "info");
        if (!window.Tesseract) await loadScript("/tesseract/tesseract.min.js");
        tesseractWorker = await (window.Tesseract as unknown as TesseractGlobal).createWorker("osd", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract/tesseract-core.wasm.js",
          langPath: "/tesseract/lang/",
        });
        await tesseractWorker.setParameters({ tessedit_pageseg_mode: "0" });
        log("OCR 引擎就绪", "ok");
      }

      const totalPages = rows.reduce((s, r) => s + r.pages, 0);
      let processedPages = 0;

      for (let fi = 0; fi < rows.length; fi++) {
        if (cancelRef.current) {
          log("已取消", "warn");
          break;
        }
        const row = rows[fi];
        if (row.status === "error") continue;

        setRows((prev) => prev.map((r, i) => (i === fi ? { ...r, status: "processing" } : r)));
        log(`[${fi + 1}/${rows.length}] 处理 ${row.name}（${row.pages} 页）…`, "info");

        try {
          const blob = row.blob;
          if (!blob) {
            log(`  ${row.name}：缺少原始数据，跳过`, "err");
            setRows((prev) => prev.map((r, i) => (i === fi ? { ...r, status: "error", message: "缺少数据" } : r)));
            continue;
          }

          const buf = await blob.arrayBuffer();
          const doc = await PDFDocument.load(buf);
          const pages = doc.getPages();
          let rotatedCount = 0;

          /* 智能/深度模式：文件级图片方向检测（横图竖页 → 旋转 90°） */
          let fileImageRotation: number | null = null;
          if (mode === "smart" || mode === "deep") {
            fileImageRotation = detectImageRotation(buf);
            if (fileImageRotation !== null) {
              const page = getPageSizeFromBytes(buf);
              const img = getImageDimsFromBytes(buf);
              log(
                `  图片方向检测：页面 ${Math.round(page.w)}x${Math.round(page.h)}（${page.h > page.w ? "竖" : "横"}版），` +
                  `图片 ${img?.w}x${img?.h}（${img && img.h > img.w ? "竖" : "横"}向）→ 需旋转 ${fileImageRotation}°`,
                "info",
              );
            }
          }

          /* 深度模式：用 pdf.js 加载同一份 PDF 用于渲染 */
          let pdfDocForRender: import("pdfjs-dist").PDFDocumentProxy | null = null;
          if (mode === "deep" && pdfjsLib) {
            pdfDocForRender = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
          }

          for (let pi = 0; pi < pages.length; pi++) {
            if (cancelRef.current) break;
            const page = pages[pi];
            const currentRot = page.getRotation().angle;
            let targetRot = currentRot;
            let reason = "";

            if (mode === "manual") {
              /* 手动模式：所有页旋转至指定角度 */
              targetRot = manualAngle;
              if (currentRot !== manualAngle) reason = `手动旋转 ${currentRot}° → ${manualAngle}°`;
            } else {
              /* 智能/深度模式：逐层检测 */

              /* 第 1 层：/Rotate 属性修正 */
              if (currentRot !== 0) {
                targetRot = 0;
                reason = `修正 /Rotate ${currentRot}° → 0°`;
              }

              /* 第 2 层：图片方向检测（横图竖页） */
              if (fileImageRotation !== null && targetRot === currentRot) {
                targetRot = (currentRot + fileImageRotation) % 360;
                reason = `图片方向不匹配，旋转 ${fileImageRotation}° → ${targetRot}°`;
              }

              /* 第 3 层（仅深度模式）：OCR OSD 检测文字方向（覆盖 180° 倒转） */
              if (mode === "deep" && pdfjsLib && pdfDocForRender && tesseractWorker) {
                try {
                  const imgBlob = await renderPageToBlob(pdfjsLib, pdfDocForRender, pi + 1);
                  const { data } = await tesseractWorker.recognize(imgBlob);
                  const osd = data.orientationDegrees ?? 0;
                  const conf = data.orientationConfidence ?? 0;
                  if (osd !== 0 && conf >= 20) {
                    /* 在已有旋转基础上叠加 OSD 检测角度 */
                    targetRot = (targetRot + osd) % 360;
                    reason = `${reason ? reason + "；" : ""}OCR 检测文字方向 ${osd}°（置信度 ${conf.toFixed(0)}%）→ ${targetRot}°`;
                  } else if (osd === 0 && conf > 0) {
                    /* OSD 确认方向正确，不额外旋转 */
                  }
                } catch {
                  log(`  第 ${pi + 1} 页：OCR 检测失败，跳过该层`, "warn");
                }
              }
            }

            /* 应用旋转 */
            if (targetRot !== currentRot) {
              page.setRotation(degrees(targetRot));
              rotatedCount++;
              log(`  第 ${pi + 1} 页：${reason}`, "ok");
            }

            processedPages++;
            setProgress(Math.round((processedPages / totalPages) * 100));
          }

          /* 保存 */
          const outBytes = await doc.save();
          const outBlob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" });

          setRows((prev) =>
            prev.map((r, i) =>
              i === fi ? { ...r, status: "done", rotated: rotatedCount, blob: outBlob } : r,
            ),
          );
          log(`  ${row.name} 完成：旋转 ${rotatedCount} 页`, "ok");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "处理失败";
          log(`  ${row.name}：${msg}`, "err");
          setRows((prev) => prev.map((r, i) => (i === fi ? { ...r, status: "error", message: msg } : r)));
        }
      }

      if (!cancelRef.current) log("全部处理完成", "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "处理失败";
      log(msg, "err");
    } finally {
      if (tesseractWorker) await tesseractWorker.terminate().catch(() => {});
      setBusy(false);
    }
  };

  /* ---------- 下载 ---------- */
  const download = async () => {
    const done = rows.filter((r) => r.status === "done" && r.blob);
    if (done.length === 0) return;
    if (done.length === 1) {
      const url = URL.createObjectURL(done[0].blob!);
      const a = document.createElement("a");
      a.href = url;
      a.download = done[0].name.replace(/\.pdf$/i, "_rotated.pdf");
      a.click();
      URL.revokeObjectURL(url);
      log(`已下载 ${done[0].name}`, "ok");
    } else {
      const zip = new JSZip();
      for (const r of done) {
        zip.file(r.name.replace(/\.pdf$/i, "_rotated.pdf"), r.blob!);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pdf_rotated.zip";
      a.click();
      URL.revokeObjectURL(url);
      log(`已打包下载 ${done.length} 个 PDF`, "ok");
    }
  };

  const doneCount = rows.filter((r) => r.status === "done").length;
  const modeHint =
    mode === "smart"
      ? "智能模式：先修正 PDF 的 /Rotate 属性，再通过分析内部图片宽高比检测横图竖页（自动旋转 90°）。速度快，覆盖绝大多数扫描件。"
      : mode === "deep"
        ? "深度模式：在智能模式基础上，用 OCR（tesseract.js）逐页检测文字实际方向，可识别 180° 倒转。速度较慢，适合内容倒置的扫描件。"
        : "手动模式：将所有 PDF 的每一页旋转至你指定的角度。适合智能/深度模式判断方向相反的情况（如横图竖页应旋转 270° 而非 90°）。";

  return (
    <div className="fade-rise">
      <ToolHead
        title="PDF 自动旋转"
        lede="上传多个 PDF 或压缩包，自动识别方向并旋转正 — 全部本地处理，文件不上传"
        chip={
          <span>
            <IconRotate width={12} height={12} />
            本地处理 · 隐私安全
          </span>
        }
      />

      <div className="vc-two-col">
        {/* 左：配置 */}
        <div className="panel">
          <div className="panel-head">
            <span className="label">配置</span>
            <span className="right subtle">{rows.length} 个文件</span>
          </div>
          <div className="panel-body">
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

            {/* 文件列表 */}
            {rows.length > 0 && (
              <div className="vc-file-list">
                {rows.map((r, i) => (
                  <div key={`${r.name}-${i}`} className="vc-file-row">
                    <IconFile width={16} height={16} className="vc-file-ico" />
                    <div className="vc-file-info">
                      <span className="vc-file-name" title={r.name}>
                        {r.name}
                      </span>
                      <span className="vc-file-sub">
                        {r.pages} 页 · {fmtSize(r.size)}
                        {r.status === "done" && ` · 旋转 ${r.rotated} 页`}
                        {r.status === "error" && ` · ${r.message}`}
                      </span>
                    </div>
                    <span className={`vc-file-status vc-status-${r.status}`}>
                      {r.status === "pending" && "待处理"}
                      {r.status === "processing" && "处理中"}
                      {r.status === "done" && "完成"}
                      {r.status === "error" && "失败"}
                    </span>
                    {!busy && (
                      <button className="vc-file-del" onClick={() => removeRow(i)} title="移除">
                        <IconX width={14} height={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 模式选择 */}
            <div className="vc-mode-row">
              <span className="vc-mode-label">检测模式</span>
              <div className="vc-mode-seg">
                <button
                  type="button"
                  className={`vc-mode-btn ${mode === "smart" ? "active" : ""}`}
                  onClick={() => setMode("smart")}
                  disabled={busy}
                >
                  智能
                </button>
                <button
                  type="button"
                  className={`vc-mode-btn ${mode === "deep" ? "active" : ""}`}
                  onClick={() => setMode("deep")}
                  disabled={busy}
                >
                  深度（OCR）
                </button>
                <button
                  type="button"
                  className={`vc-mode-btn ${mode === "manual" ? "active" : ""}`}
                  onClick={() => setMode("manual")}
                  disabled={busy}
                >
                  手动
                </button>
              </div>
            </div>

            {/* 手动模式角度选择 */}
            {mode === "manual" && (
              <div className="vc-manual-row">
                <span className="vc-mode-label">旋转角度</span>
                <div className="vc-mode-seg">
                  {[0, 90, 180, 270].map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`vc-mode-btn ${manualAngle === a ? "active" : ""}`}
                      onClick={() => setManualAngle(a)}
                      disabled={busy}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="vc-mode-hint">{modeHint}</p>

            {/* 操作按钮 */}
            <div className="vc-actions">
              <button className="btn btn-primary" onClick={run} disabled={busy || rows.length === 0}>
                {busy ? <IconLoader width={16} height={16} className="spin" /> : <IconRotate width={16} height={16} />}
                {busy ? "处理中…" : "开始旋转"}
              </button>
              <button className="btn" onClick={download} disabled={doneCount === 0 || busy}>
                <IconDownload width={16} height={16} />
                下载{doneCount > 1 ? "打包" : ""}
              </button>
              <button className="btn btn-ghost" onClick={clearAll} disabled={busy}>
                <IconTrash width={16} height={16} />
                清空
              </button>
              {busy && (
                <button className="btn btn-danger" onClick={() => (cancelRef.current = true)}>
                  取消
                </button>
              )}
            </div>

            {busy && (
              <div className="vc-progress">
                <div className="vc-progress-bar">
                  <div className="vc-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="vc-progress-text">{progress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* 右：日志 */}
        <div className={`panel vc-log-panel ${fullscreen ? "vc-log-fullscreen" : ""}`}>
          <div className="panel-head">
            <span className="label">运行日志</span>
            <div className="right">
              <span className="subtle">{logs.length} 条</span>
              <button className="vc-log-fs" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? "退出全屏" : "全屏"}>
                <IconEye width={14} height={14} />
              </button>
            </div>
          </div>
          <div className="panel-body vc-log-body">
            {logs.length === 0 ? (
              <div className="vc-log-empty">配置完成后点击「开始旋转」，日志将在此实时输出。</div>
            ) : (
              <div className="vc-log-list">
                {logs.map((l, i) => (
                  <div key={i} className={`vc-log-line vc-log-${l.kind}`}>
                    <span className="vc-log-time">{l.time}</span>
                    <span className="vc-log-text">{l.text}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vc-footer">
        <strong>说明：</strong>
        所有处理在浏览器本地完成，PDF 文件不上传服务器。智能模式通过 /Rotate 属性 + 内部图片宽高比检测自动旋转（横图竖页旋转 90°）；深度模式额外用 OCR 逐页检测文字方向（可识别 180° 倒转）；手动模式可指定角度。若智能模式旋转后方向相反（应为 270° 而非 90°），请切换手动模式选 270°。
      </div>
    </div>
  );
}
