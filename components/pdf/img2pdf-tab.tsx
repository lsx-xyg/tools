"use client";

import { useCallback, useRef, useState } from "react";
import {
  IconFileStack,
  IconImage,
  IconLoader,
} from "@/components/icons";
import { FileDropZone } from "@/components/drop-zone";
import { downloadBytes, imagesToPdf } from "@/lib/pdf-utils";
import { PdfFileList, type PdfFileItem } from "@/components/pdf/pdf-file-list";

type ImgRow = PdfFileItem & { width: number; height: number };

const IMG_EXT = /\.(png|jpe?g|webp)$/i;

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片：${file.name}`));
    };
    img.src = url;
  });
}

export function Img2PdfTab() {
  const [rows, setRows] = useState<ImgRow[]>([]);
  const [pageSize, setPageSize] = useState<"a4" | "auto">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const idRef = useRef(0);

  const addFiles = useCallback(async (list: File[]) => {
    const arr = list.filter((f) => IMG_EXT.test(f.name));
    if (!arr.length) {
      setErr("请选择图片文件（JPG / PNG / WebP）");
      return;
    }
    setErr("");
    for (const f of arr) {
      try {
        const { img, url } = await loadImage(f);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(url);
        setRows((prev) => [
          ...prev,
          {
            id: String(idRef.current++),
            kind: "image",
            name: f.name,
            file: f,
            width,
            height,
            rotation: 0,
            extra: `${width}×${height}`,
          },
        ]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "图片读取失败");
      }
    }
  }, []);

  async function run() {
    if (!rows.length) return;
    setBusy(true);
    setErr("");
    try {
      const data = await imagesToPdf(
        rows.map((r) => ({ blob: r.file, width: r.width, height: r.height, rotation: r.rotation as 0 | 90 | 180 | 270 })),
        { pageSize, orientation },
      );
      downloadBytes(data, "images.pdf");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "PDF 生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="single-panel tab-anim">
      <FileDropZone
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        icon={<IconImage width={18} height={18} />}
        label="拖入图片，或点击选择文件"
        hint="可多选 · JPG / PNG / WebP"
        onFiles={(files) => void addFiles(files)}
        disabled={busy}
      />

      {rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <PdfFileList items={rows} onChange={(next) => setRows(next as ImgRow[])} disabled={busy} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="vd-grid" style={{ marginTop: 14 }}>
          <div className="vd-field">
            <label className="vc-label">页面尺寸</label>
            <select className="input" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "auto")} disabled={busy}>
              <option value="a4">A4</option>
              <option value="auto">按图片自适应</option>
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
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{rows.length} 张图片 · 按列表顺序合并</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void run()} type="button" disabled={busy || !rows.length}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "生成中…" : "合并为 PDF"}
        </button>
      </div>
    </div>
  );
}
