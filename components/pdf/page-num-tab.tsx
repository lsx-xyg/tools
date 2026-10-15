"use client";

import { useRef, useState } from "react";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { addPageNumbers, downloadBytes, pdfError, pdfPages, rotatePdfBytes } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";

export function PageNumTab() {
  const [items, setItems] = useState<PdfFileItem[]>([]);
  const idRef = useRef(1);
  const [position, setPosition] = useState<"bottom-center" | "bottom-left" | "bottom-right">("bottom-center");
  const [format, setFormat] = useState<"full" | "slash" | "number">("slash");
  const [startAt, setStartAt] = useState("1");
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState(36);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const file = items[0];

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
      setItems([{ id: String(idRef.current++), kind: "pdf", name: f.name, file: f, bytes, pages, rotation: 0 }]);
    } catch (e) {
      setErr(pdfError(e));
    }
  };

  async function run() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const bytes = await rotatePdfBytes(file.bytes!, file.rotation);
      const out = await addPageNumbers(bytes, {
        position,
        format,
        startAt: Number(startAt) || 1,
        fontSize,
        margin,
      });
      downloadBytes(out, file.name.replace(/\.pdf$/i, "-pagenum.pdf"));
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
        icon={<IconPlus width={18} height={18} />}
        label="拖入 PDF，或点击选择文件"
        onFiles={(files) => void addFile(files)}
      />

      {file && (
        <div style={{ marginTop: 14 }}>
          <PdfFileList items={items} onChange={setItems} disabled={busy} />
        </div>
      )}

      {file && (
        <div className="vd-grid" style={{ marginTop: 14 }}>
          <div className="vd-field">
            <label className="vc-label">位置</label>
            <select className="input" value={position} onChange={(e) => setPosition(e.target.value as typeof position)}>
              <option value="bottom-center">底部居中</option>
              <option value="bottom-left">左下角</option>
              <option value="bottom-right">右下角</option>
            </select>
          </div>
          <div className="vd-field">
            <label className="vc-label">格式</label>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              <option value="full">第 X 页 / 共 N 页</option>
              <option value="slash">X / N</option>
              <option value="number">仅数字</option>
            </select>
          </div>
          <div className="vd-field">
            <label className="vc-label">起始页码</label>
            <input className="input" inputMode="numeric" value={startAt} onChange={(e) => setStartAt(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="vd-field">
            <label className="vc-label">字号（{fontSize} pt）</label>
            <input type="range" min={8} max={24} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="vd-field">
            <label className="vc-label">边距（{margin} pt）</label>
            <input type="range" min={18} max={72} step={2} value={margin} onChange={(e) => setMargin(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{file ? `将为 ${file.pages} 页添加页码` : "未选择文件"}</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || !file}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "处理中…" : "添加页码并下载"}
        </button>
      </div>
    </div>
  );
}
