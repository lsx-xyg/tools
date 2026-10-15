"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { compressPdf, downloadBytes, pdfError, rotatePdfBytes } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";

type CompressRow = PdfFileItem & { before: number; after?: number; done: boolean };

const fmt = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

export function CompressTab() {
  const [rows, setRows] = useState<CompressRow[]>([]);
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
    setBusy(true);
    setErr("");
    try {
      const zip = new JSZip();
      let one: { name: string; data: Uint8Array } | null = null;
      for (const r of rows) {
        try {
          const rotated = await rotatePdfBytes(r.bytes!, r.rotation);
          const { data, after } = await compressPdf(rotated);
          setRows((prev) => prev.map((p) => (p.id === r.id ? { ...p, after, done: true } : p)));
          const outName = r.name.replace(/\.pdf$/i, "_compressed.pdf");
          zip.file(outName, data);
          one = { name: outName, data };
        } catch (e) {
          setErr(pdfError(e));
        }
      }
      if (rows.length === 1 && one) {
        downloadBytes(one.data, one.name);
      } else {
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBytes(blob, "pdf_compressed.zip");
      }
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

      <p className="count-hint" style={{ marginTop: 10 }}>
        在浏览器内重建 PDF 结构、剔除冗余对象；对文本型 PDF 效果较好，扫描图片型效果有限。不做图片重采样，不改变画质。
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
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || !rows.length}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "压缩中…" : "压缩并下载"}
        </button>
      </div>
    </div>
  );
}
