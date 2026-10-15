"use client";

import { useCallback, useRef, useState } from "react";
import { IconFileStack, IconImage, IconLoader } from "@/components/icons";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";
import { completeTask, createTask, failTask, hasRunningTask, updateTask } from "@/lib/task-center";
import { downloadBytes, getPdfjs, scanToPdf, type ScanMode } from "@/lib/pdf-utils";

const TOOL_NAME = "PDF 扫描合成";

type ScanRow = PdfFileItem & { width?: number; height?: number };

const IMG_EXT = /\.(png|jpe?g|webp)$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MODES: { value: ScanMode; label: string; hint: string }[] = [
  { value: "color", label: "原色", hint: "保持彩色，适合证件、票据" },
  { value: "gray", label: "灰度", hint: "黑白灰，最接近扫描件观感" },
  { value: "bw", label: "黑白", hint: "增强对比近似二值，省墨清晰" },
];

function loadImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    img.src = url;
  });
}

export function ScanPdfTab() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [pageSize, setPageSize] = useState<"a4" | "auto">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [mode, setMode] = useState<ScanMode>("gray");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const idRef = useRef(0);

  const addFiles = useCallback(async (list: File[]) => {
    if (!list.length) return;
    setErr("");
    const next: ScanRow[] = [];
    for (const f of list) {
      const id = String(idRef.current++);
      try {
        if (IMG_EXT.test(f.name)) {
          const { width, height } = await loadImage(f);
          next.push({
            id,
            kind: "image",
            name: f.name,
            file: f,
            width,
            height,
            rotation: 0,
            extra: `${width}×${height}`,
          });
        } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          const bytes = await f.arrayBuffer();
          const pdfjs = await getPdfjs();
          const src = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
          const pages = src.numPages;
          await src.destroy();
          next.push({
            id,
            kind: "pdf",
            name: f.name,
            file: f,
            bytes,
            pages,
            rotation: 0,
            extra: `${pages} 页`,
          });
        } else if (f.type === DOCX_MIME || /\.docx$/i.test(f.name)) {
          next.push({
            id,
            kind: "doc",
            name: f.name,
            file: f,
            rotation: 0,
            extra: "Word 文档",
          });
        } else {
          setErr(`跳过不支持的格式：${f.name}（支持 JPG / PNG / WebP / PDF / Word .docx）`);
        }
      } catch (e) {
        setErr(`无法读取 ${f.name}：${e instanceof Error ? e.message : "未知错误"}`);
      }
    }
    if (next.length) setRows((prev) => [...prev, ...next]);
  }, []);

  async function run() {
    if (!rows.length) return;
    if (hasRunningTask(TOOL_NAME)) {
      setErr("已有扫描合成任务进行中，完成后再提交新的（进度见右下角任务中心）。");
      return;
    }
    setBusy(true);
    setErr("");
    const taskId = createTask(TOOL_NAME, `${rows.length} 份文档 · ${MODES.find((m) => m.value === mode)?.label ?? mode}`);
    try {
      const data = await scanToPdf(
        rows.map((r) => ({
          kind: r.kind,
          name: r.name,
          file: r.file,
          bytes: r.bytes,
          rotation: r.rotation as 0 | 90 | 180 | 270,
        })),
        {
          pageSize,
          orientation,
          mode,
          onProgress: (p) => updateTask(taskId, { progress: p }),
        },
      );
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = `scanned_${Date.now()}.pdf`;
      downloadBytes(data, name);
      completeTask(taskId, url, name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "扫描合成失败";
      failTask(taskId, msg);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="single-panel tab-anim">
      <FileDropZone
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        multiple
        icon={<IconImage width={18} height={18} />}
        label="拖入图片 / PDF / Word，或点击选择文件"
        hint="可多选 · 混合上传 · 按列表顺序合成"
        onFiles={(files) => void addFiles(files)}
        disabled={busy}
      />

      {rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <PdfFileList items={rows} onChange={(next) => setRows(next as ScanRow[])} disabled={busy} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="vd-grid" style={{ marginTop: 14 }}>
          <div className="vd-field">
            <label className="vc-label">页面尺寸</label>
            <select className="input" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "auto")} disabled={busy}>
              <option value="a4">A4</option>
              <option value="auto">按内容自适应</option>
            </select>
          </div>
          {pageSize === "a4" && (
            <div className="vd-field">
              <label className="vc-label">A4 方向</label>
              <select className="input" value={orientation} onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")} disabled={busy}>
                <option value="portrait">纵向</option>
                <option value="landscape">横向</option>
              </select>
            </div>
          )}
          <div className="vd-field">
            <label className="vc-label">扫描效果</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as ScanMode)} disabled={busy}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <p className="count-hint" style={{ marginTop: 10 }}>
          {MODES.find((m) => m.value === mode)?.hint} · 图片 / PDF / Word 会统一栅格化为扫描件页（文字不可选中，如真实扫描件）
        </p>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{rows.length} 份文档 · 按列表顺序合成一个 PDF</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || hasRunningTask(TOOL_NAME) || !rows.length}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "合成中…（可切走，见右下角任务中心）" : "合成扫描件 PDF"}
        </button>
      </div>
    </div>
  );
}
