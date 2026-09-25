"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { TruncatedText } from "@/components/tooltip";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconFileStack,
  IconLoader,
  IconPlus,
  IconShield,
  IconTrash,
  IconX,
} from "@/components/icons";
import {
  downloadBytes,
  extractPages,
  mergePdfs,
  parseRanges,
  pdfError,
  pdfPages,
  splitByN,
} from "@/lib/pdf-utils";
import JSZip from "jszip";

type Mode = "merge" | "split";

interface PdfItem {
  id: number;
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}

function downloadName(name: string, suffix: string): string {
  const base = name.replace(/\.pdf$/i, "");
  return `${base}${suffix}.pdf`;
}

export default function PdfPage() {
  const [mode, setMode] = useState<Mode>("merge");

  // 合并
  const [items, setItems] = useState<PdfItem[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeErr, setMergeErr] = useState("");
  const mergeId = useRef(0);

  // 拆分
  const [splitFile, setSplitFile] = useState<PdfItem | null>(null);
  const [splitErr, setSplitErr] = useState("");
  const [range, setRange] = useState("");
  const [every, setEvery] = useState("");
  const [busy, setBusy] = useState("");

  const totalPages = useMemo(() => splitFile?.pages ?? 0, [splitFile]);

  const addFiles = useCallback(async (files: File[]) => {
    const list = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (list.length === 0) {
      setMergeErr("请选择 PDF 文件");
      return;
    }
    setMergeErr("");
    const next: PdfItem[] = [];
    for (const f of list) {
      try {
        const bytes = await f.arrayBuffer();
        const pages = await pdfPages(bytes);
        next.push({ id: mergeId.current++, name: f.name, bytes, pages });
      } catch (e) {
        setMergeErr(pdfError(e));
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
      setMergeErr("至少选择 2 个 PDF 才能合并");
      return;
    }
    setMergeBusy(true);
    setMergeErr("");
    try {
      const out = await mergePdfs(items.map((x) => x.bytes));
      downloadBytes(out, "merged.pdf");
    } catch (e) {
      setMergeErr(pdfError(e));
    } finally {
      setMergeBusy(false);
    }
  }

  const addSplit = useCallback(async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
    if (!f) {
      setSplitErr("请选择 PDF 文件");
      return;
    }
    setSplitErr("");
    try {
      const bytes = await f.arrayBuffer();
      const pages = await pdfPages(bytes);
      setSplitFile({ id: mergeId.current++, name: f.name, bytes, pages });
      setRange("");
    } catch (e) {
      setSplitErr(pdfError(e));
    }
  }, []);

  async function doExtract() {
    if (!splitFile) return;
    setBusy("extract");
    setSplitErr("");
    try {
      const indices = parseRanges(range, totalPages);
      if (indices.length === 0) {
        setSplitErr("页码范围无效，例如 1-3,5,7-9");
        return;
      }
      const out = await extractPages(splitFile.bytes, indices);
      downloadBytes(out, downloadName(splitFile.name, `-p${indices.map((i) => i + 1).join("_")}`));
    } catch (e) {
      setSplitErr(pdfError(e));
    } finally {
      setBusy("");
    }
  }

  async function doSplitEvery() {
    if (!splitFile) return;
    const n = Number(every);
    if (!Number.isInteger(n) || n < 1) {
      setSplitErr("请输入正整数（每 N 页）");
      return;
    }
    setBusy("split");
    setSplitErr("");
    try {
      const chunks = await splitByN(splitFile.bytes, n);
      const zip = new JSZip();
      for (const c of chunks) zip.file(`${downloadName(splitFile.name, "")}-${c.name}.pdf`, c.data);
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBytes(blob, downloadName(splitFile.name, "-parts"));
    } catch (e) {
      setSplitErr(pdfError(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="PDF 处理"
        lede="合并多个 PDF / 拆分提取指定页面"
        chip={
          <span>
            <IconShield width={12} height={12} />
            浏览器本地 · 文件不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="PDF 模式">
        <button data-active={mode === "merge"} onClick={() => setMode("merge")} type="button">
          合并
        </button>
        <button data-active={mode === "split"} onClick={() => setMode("split")} type="button">
          拆分
        </button>
      </div>

      {mode === "merge" ? (
        <div className="single-panel tab-anim" key="merge">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              id="pdf-merge-input"
              hidden
              onChange={(e) => void addFiles(Array.from(e.target.files ?? []))}
            />
            <label htmlFor="pdf-merge-input" className="dropzone-inner">
              <span className="dropzone-ic">
                <IconPlus width={18} height={18} />
              </span>
              拖入多个 PDF，或点击选择文件
            </label>
          </div>

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

          {mergeErr && <p className="count-hint warn" style={{ marginTop: 10 }}>{mergeErr}</p>}

          <div className="tool-row" style={{ marginTop: 14 }}>
            <span className="count-hint">{items.length} 个文件 · {items.reduce((a, b) => a + b.pages, 0)} 页</span>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={() => void doMerge()} type="button" disabled={mergeBusy || items.length < 2}>
              {mergeBusy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
              {mergeBusy ? "合并中…" : "合并 PDF"}
            </button>
          </div>
        </div>
      ) : (
        <div className="single-panel tab-anim" key="split">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addSplit(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              id="pdf-split-input"
              hidden
              onChange={(e) => void addSplit(Array.from(e.target.files ?? []))}
            />
            <label htmlFor="pdf-split-input" className="dropzone-inner">
              <span className="dropzone-ic">
                <IconPlus width={18} height={18} />
              </span>
              {splitFile ? `已选择：${splitFile.name}` : "拖入 PDF，或点击选择文件"}
            </label>
          </div>

          {splitFile && (
            <>
              <p className="count-hint" style={{ marginTop: 12 }}>共 {totalPages} 页 · 当前文档 {splitFile.name}</p>

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
                    placeholder={`1-${Math.min(3, totalPages)}`}
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

          {splitErr && <p className="count-hint warn" style={{ marginTop: 10 }}>{splitErr}</p>}
        </div>
      )}
    </div>
  );
}
