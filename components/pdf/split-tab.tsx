"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import { IconCheck, IconFileStack, IconLoader, IconPlus } from "@/components/icons";
import {
  downloadBytes,
  extractPages,
  parseRanges,
  pdfError,
  pdfPages,
  splitByN,
} from "@/lib/pdf-utils";

interface SplitFile {
  id: number;
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}

function downloadName(name: string, suffix: string): string {
  const base = name.replace(/\.pdf$/i, "");
  return `${base}${suffix}.pdf`;
}

export function SplitTab() {
  const [file, setFile] = useState<SplitFile | null>(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("");
  const [every, setEvery] = useState("");
  const [busy, setBusy] = useState("");
  const idRef = useRef(0);

  const addFile = useCallback(async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
    if (!f) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    try {
      const bytes = await f.arrayBuffer();
      const pages = await pdfPages(bytes);
      setFile({ id: idRef.current++, name: f.name, bytes, pages });
      setRange("");
    } catch (e) {
      setErr(pdfError(e));
    }
  }, []);

  async function doExtract() {
    if (!file) return;
    setBusy("extract");
    setErr("");
    try {
      const indices = parseRanges(range, file.pages);
      if (indices.length === 0) {
        setErr("页码范围无效，例如 1-3,5,7-9");
        return;
      }
      const out = await extractPages(file.bytes, indices);
      downloadBytes(out, downloadName(file.name, `-p${indices.map((i) => i + 1).join("_")}`));
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy("");
    }
  }

  async function doSplitEvery() {
    if (!file) return;
    const n = Number(every);
    if (!Number.isInteger(n) || n < 1) {
      setErr("请输入正整数（每 N 页）");
      return;
    }
    setBusy("split");
    setErr("");
    try {
      const chunks = await splitByN(file.bytes, n);
      const zip = new JSZip();
      for (const c of chunks) zip.file(`${downloadName(file.name, "")}-${c.name}.pdf`, c.data);
      const blob = await zip.generateAsync({ type: "blob" });
      const base = file.name.replace(/\.pdf$/i, "");
      downloadBytes(blob, `${base}-parts.zip`);
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="single-panel tab-anim">
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFile(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          id="pdf-split-input"
          hidden
          onChange={(e) => void addFile(Array.from(e.target.files ?? []))}
        />
        <label htmlFor="pdf-split-input" className="dropzone-inner">
          <span className="dropzone-ic">
            <IconPlus width={18} height={18} />
          </span>
          {file ? `已选择：${file.name}` : "拖入 PDF，或点击选择文件"}
        </label>
      </div>

      {file && (
        <>
          <p className="count-hint" style={{ marginTop: 12 }}>共 {file.pages} 页 · 当前文档 {file.name}</p>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-head">
              <span className="label">提取指定页面</span>
              <span className="count-hint">支持 1-3,5,7-9</span>
            </div>
            <div className="tool-row" style={{ marginTop: 10 }}>
              <input
                className="input mono"
                style={{ flex: 1 }}
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder={`1-${Math.min(3, file.pages)}`}
                spellCheck={false}
              />
              <button
                className="btn btn-primary"
                onClick={() => void doExtract()}
                type="button"
                disabled={busy !== "" || !range.trim()}
              >
                {busy === "extract" ? <IconLoader width={15} height={15} className="spin" /> : <IconCheck width={15} height={15} />}
                {busy === "extract" ? "提取中…" : "提取"}
              </button>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-head">
              <span className="label">按每 N 页拆分</span>
              <span className="count-hint">打包为 zip 下载</span>
            </div>
            <div className="tool-row" style={{ marginTop: 10 }}>
              <span className="count-hint">每</span>
              <input
                className="input mono"
                style={{ width: 72, textAlign: "center" }}
                value={every}
                onChange={(e) => setEvery(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
              />
              <span className="count-hint">页一份</span>
              <span className="spacer" />
              <button
                className="btn btn-ghost"
                onClick={() => void doSplitEvery()}
                type="button"
                disabled={busy !== "" || !every}
              >
                {busy === "split" ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
                {busy === "split" ? "拆分中…" : "拆分打包"}
              </button>
            </div>
          </div>
        </>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}
    </div>
  );
}
