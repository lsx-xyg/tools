"use client";

import { useRef, useState } from "react";
import {
  IconFileStack,
  IconLoader,
  IconPlus,
} from "@/components/icons";
import { addWatermark, downloadBytes, pdfError, pdfPages, rotatePdfBytes } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";

const COLORS: { label: string; value: string }[] = [
  { label: "黑", value: "#000000" },
  { label: "灰", value: "#666666" },
  { label: "红", value: "#cc0000" },
  { label: "蓝", value: "#1a56db" },
];

export function WatermarkTab() {
  const [items, setItems] = useState<PdfFileItem[]>([]);
  const idRef = useRef(1);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(28);
  const [opacity, setOpacity] = useState(20);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState("#666666");
  const [tiled, setTiled] = useState(true);
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
    if (!text.trim()) {
      setErr("请输入水印文字");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const bytes = await rotatePdfBytes(file.bytes!, file.rotation);
      const out = await addWatermark(bytes, {
        text: text.trim(),
        fontSize,
        opacity: opacity / 100,
        angle,
        color,
        tiled,
      });
      downloadBytes(out, file.name.replace(/\.pdf$/i, "-watermark.pdf"));
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
            <label className="vc-label">水印文字</label>
            <input className="input" placeholder="如 内部资料 · 禁止外传" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="vd-field">
            <label className="vc-label">字号（{fontSize} pt）</label>
            <input type="range" min={12} max={60} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="vd-field">
            <label className="vc-label">不透明度（{opacity}%）</label>
            <input type="range" min={10} max={50} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="vd-field">
            <label className="vc-label">旋转角度（{angle}°）</label>
            <input type="range" min={0} max={90} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="vd-field">
            <label className="vc-label">颜色</label>
            <select className="input" value={color} onChange={(e) => setColor(e.target.value)}>
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="vd-field">
            <label className="vc-label">排布方式</label>
            <select className="input" value={tiled ? "tiled" : "center"} onChange={(e) => setTiled(e.target.value === "tiled")}>
              <option value="tiled">整页平铺</option>
              <option value="center">居中单条</option>
            </select>
          </div>
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{file ? `将为 ${file.pages} 页添加水印` : "未选择文件"}</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || !file}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "处理中…" : "添加水印并下载"}
        </button>
      </div>
    </div>
  );
}
