"use client";

import { useCallback, useRef, useState } from "react";
import { TruncatedText } from "@/components/tooltip";
import {
  IconArrowDown,
  IconArrowUp,
  IconFileStack,
  IconLoader,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import { downloadBytes, mergePdfs, pdfError, pdfPages } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";

interface PdfItem {
  id: number;
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}

export function MergeTab() {
  const [items, setItems] = useState<PdfItem[]>([]);
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
    const next: PdfItem[] = [];
    for (const f of list) {
      try {
        const bytes = await f.arrayBuffer();
        const pages = await pdfPages(bytes);
        next.push({ id: idRef.current++, name: f.name, bytes, pages });
      } catch (e) {
        setErr(pdfError(e));
      }
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  async function doMerge() {
    if (items.length < 2) {
      setErr("至少选择 2 个 PDF 才能合并");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const out = await mergePdfs(items.map((x) => x.bytes));
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
        <div className="pdf-list">
          {items.map((it, i) => (
            <div className="pdf-item" key={it.id}>
              <span className="pdf-order mono">{i + 1}</span>
              <span className="pdf-info">
                <TruncatedText text={it.name} className="pdf-name" />
                <span className="count-hint">{it.pages} 页</span>
              </span>
              <span className="pdf-actions">
                <button className="btn-icon" onClick={() => move(i, -1)} type="button" aria-label="上移" disabled={i === 0}>
                  <IconArrowUp width={15} height={15} />
                </button>
                <button className="btn-icon" onClick={() => move(i, 1)} type="button" aria-label="下移" disabled={i === items.length - 1}>
                  <IconArrowDown width={15} height={15} />
                </button>
                <button className="btn-icon danger" onClick={() => remove(it.id)} type="button" aria-label="移除">
                  <IconTrash width={15} height={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{items.length} 个文件 · {items.reduce((a, b) => a + b.pages, 0)} 页</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void doMerge()} type="button" disabled={busy || items.length < 2}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "合并中…" : "合并 PDF"}
        </button>
      </div>
    </div>
  );
}
