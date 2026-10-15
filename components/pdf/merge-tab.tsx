"use client";

import { useCallback, useRef, useState } from "react";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { downloadBytes, mergePdfs, pdfError, pdfPages, rotatePdfBytes } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";

export function MergeTab() {
  const [items, setItems] = useState<PdfFileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const idRef = useRef(0);

  const addFiles = useCallback(async (files: File[]) => {
    const list = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (list.length === 0) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    const next: PdfFileItem[] = [];
    for (const f of list) {
      try {
        const bytes = await f.arrayBuffer();
        const pages = await pdfPages(bytes);
        next.push({ id: String(idRef.current++), kind: "pdf", name: f.name, file: f, bytes, pages, rotation: 0 });
      } catch (e) {
        setErr(pdfError(e));
      }
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }, []);

  async function doMerge() {
    if (items.length < 2) {
      setErr("至少选择 2 个 PDF 才能合并");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const rotated: ArrayBuffer[] = [];
      for (const it of items) {
        rotated.push(await rotatePdfBytes(it.bytes!, it.rotation));
      }
      const out = await mergePdfs(rotated);
      downloadBytes(out, "merged.pdf");
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="single-panel tab-anim">
      <FileDropZone
        accept="application/pdf,.pdf"
        multiple
        icon={<IconPlus width={18} height={18} />}
        label="拖入多个 PDF，或点击选择文件"
        onFiles={(files) => void addFiles(files)}
      />

      {items.length > 0 && (
        <PdfFileList items={items} onChange={setItems} disabled={busy} />
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{items.length} 个文件 · {items.reduce((a, b) => a + (b.pages ?? 0), 0)} 页</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void doMerge()} type="button" disabled={busy || items.length < 2}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "合并中…" : "合并 PDF"}
        </button>
      </div>
    </div>
  );
}
