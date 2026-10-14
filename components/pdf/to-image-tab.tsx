"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { downloadBytes, pdfError, pdfPages, pdfToImages } from "@/lib/pdf-utils";

export function ToImageTab() {
  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer; pages: number } | null>(null);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<"png" | "jpeg">("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addFile = async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
    if (!f) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    try {
      const bytes = await f.arrayBuffer();
      const pages = await pdfPages(bytes);
      setFile({ name: f.name, bytes, pages });
    } catch (e) {
      setErr(pdfError(e));
    }
  };

  async function run() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const results = await pdfToImages(file.bytes, { scale, format, quality });
      if (results.length === 1) {
        downloadBytes(results[0].blob, results[0].name);
      } else {
        const zip = new JSZip();
        for (const r of results) zip.file(r.name, r.blob);
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBytes(blob, file.name.replace(/\.pdf$/i, "-images.zip"));
      }
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy(false);
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
          id="pdf-toimage-input"
          hidden
          onChange={(e) => void addFile(Array.from(e.target.files ?? []))}
        />
        <label htmlFor="pdf-toimage-input" className="dropzone-inner">
          <span className="dropzone-ic">
            <IconPlus width={18} height={18} />
          </span>
          {file ? `已选择：${file.name}（${file.pages} 页）` : "拖入 PDF，或点击选择文件"}
        </label>
      </div>

      {file && (
        <div className="vd-grid" style={{ marginTop: 14 }}>
          <div className="vd-field">
            <label className="vc-label">渲染倍率（{scale.toFixed(1)}x）</label>
            <input type="range" min={1} max={3} step={0.1} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="vd-field">
            <label className="vc-label">输出格式</label>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}>
              <option value="jpeg">JPEG（体积小）</option>
              <option value="png">PNG（无损）</option>
            </select>
          </div>
          {format === "jpeg" && (
            <div className="vd-field">
              <label className="vc-label">JPEG 质量（{Math.round(quality * 100)}%）</label>
              <input type="range" min={0.3} max={1} step={0.05} value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} style={{ width: "100%" }} />
            </div>
          )}
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{file ? `${file.pages} 页将逐页导出` : "未选择文件"}</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || !file}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "导出中…" : "导出图片"}
        </button>
      </div>
    </div>
  );
}
