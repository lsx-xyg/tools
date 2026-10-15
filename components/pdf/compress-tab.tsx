"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { compressPdf, downloadBytes, pdfError, rotatePdfBytes, type CompressLevel } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";
import { completeTask, createTask, failTask, hasRunningTask, updateTask } from "@/lib/task-center";

const TOOL_NAME = "PDF 压缩";

type CompressRow = PdfFileItem & { before: number; after?: number; done: boolean };

const fmt = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

const LEVELS: { value: CompressLevel; label: string }[] = [
  { value: "auto", label: "建议" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export function CompressTab() {
  const [rows, setRows] = useState<CompressRow[]>([]);
  const [level, setLevel] = useState<CompressLevel>("auto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const idRef = useRef(0);

  const addFiles = async (files: File[]) => {
    const list = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!list.length) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    for (const f of list) {
      try {
        const bytes = await f.arrayBuffer();
        setRows((prev) => [
          ...prev,
          {
            id: String(idRef.current++),
            kind: "pdf",
            name: f.name,
            file: f,
            bytes,
            rotation: 0,
            before: bytes.byteLength,
            done: false,
          },
        ]);
      } catch {
        setErr(`无法读取 ${f.name}`);
      }
    }
  };

  async function run() {
    if (!rows.length) return;
    if (hasRunningTask(TOOL_NAME)) {
      setErr("已有压缩任务进行中，完成后再提交新的（进度见右下角任务中心）。");
      return;
    }
    setBusy(true);
    setErr("");
    const taskId = createTask(TOOL_NAME, `${rows.length} 个文件压缩（${level}）`);
    try {
      const zip = new JSZip();
      let one: { name: string; data: Uint8Array } | null = null;
      const total = rows.length;
      for (let idx = 0; idx < rows.length; idx += 1) {
        const r = rows[idx];
        try {
          const rotated = await rotatePdfBytes(r.bytes!, r.rotation);
          const { data, after } = await compressPdf(rotated, {
            level,
            onProgress: (p) => updateTask(taskId, { progress: (idx + p) / total }),
          });
          setRows((prev) => prev.map((p) => (p.id === r.id ? { ...p, after, done: true } : p)));
          const outName = r.name.replace(/\.pdf$/i, "_compressed.pdf");
          zip.file(outName, data);
          one = { name: outName, data };
        } catch (e) {
          setErr(pdfError(e));
        }
      }
      let url: string;
      let name: string;
      if (rows.length === 1 && one) {
        downloadBytes(one.data, one.name);
        url = URL.createObjectURL(new Blob([one.data.buffer as ArrayBuffer], { type: "application/pdf" }));
        name = one.name;
      } else {
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBytes(blob, "pdf_compressed.zip");
        url = URL.createObjectURL(blob);
        name = "pdf_compressed.zip";
      }
      updateTask(taskId, { progress: 1 });
      completeTask(taskId, url, name);
    } catch (e) {
      failTask(taskId, pdfError(e));
    } finally {
      setBusy(false);
    }
  }

  const totalBefore = rows.reduce((a, r) => a + r.before, 0);
  const totalAfter = rows.reduce((a, r) => a + (r.after ?? r.before), 0);

  const displayRows: PdfFileItem[] = rows.map((r) => ({
    ...r,
    extra: `${fmt(r.before)} → ${r.done ? fmt(r.after ?? r.before) : "…"}${
      r.done && r.after !== undefined && r.after < r.before
        ? ` · 瘦了 ${((1 - r.after / r.before) * 100).toFixed(0)}%`
        : ""
    }`,
  }));

  return (
    <div className="single-panel tab-anim">
      <FileDropZone
        accept="application/pdf,.pdf"
        multiple
        icon={<IconPlus width={18} height={18} />}
        label="拖入多个 PDF，或点击选择文件"
        onFiles={(files) => void addFiles(files)}
      />

      <div className="vc-toolbar" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="count-hint">压缩级别</span>
        <div className="vd-segmented" role="group" aria-label="压缩级别">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              className="vd-seg-btn"
              data-active={level === l.value}
              disabled={busy}
              onClick={() => setLevel(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <p className="count-hint" style={{ marginTop: 10 }}>
        建议（同 smallpdf 默认思路）：先无损重写；图片型 PDF 会自动做高保真重编码
        （≈144dpi 渲染 + 高质量 JPEG，肉眼接近无损）并取更小者——文字保持可选中、不会糊，
        图片 PDF 也能显著瘦身。低 / 中 / 高为显式栅格化（把每页转成 JPEG 再打包）：低 ≈108dpi
        接近无损，中 86dpi，高 72dpi 明显压缩但内容清晰；扫描件 / 图片类 PDF 效果最佳，
        文本型栅格化后文字不可选中、可能反而变大。
      </p>

      {rows.length > 0 && (
        <PdfFileList
          items={displayRows}
          onChange={(next) => setRows(next as CompressRow[])}
          disabled={busy}
        />
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">
          {rows.length} 个文件 · {fmt(totalBefore)} → {fmt(totalAfter)}
        </span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || hasRunningTask(TOOL_NAME) || !rows.length}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "压缩中…（可切走，见右下角任务中心）" : "压缩并下载"}
        </button>
      </div>
    </div>
  );
}
