"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconFileStack,
  IconImage,
  IconLoader,
  IconRotateCw,
  IconTrash,
} from "@/components/icons";
import { FileDropZone } from "@/components/drop-zone";
import { downloadBytes, imagesToPdf } from "@/lib/pdf-utils";

interface ImgRow {
  id: number;
  file: File;
  preview: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

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
  const dragIdRef = useRef<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

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
        setRows((prev) => [
          ...prev,
          { id: idRef.current++, file: f, preview: url, width: img.naturalWidth, height: img.naturalHeight, rotation: 0 },
        ]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "图片读取失败");
      }
    }
  }, []);

  useEffect(() => {
    return () => rows.forEach((r) => URL.revokeObjectURL(r.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (id: number) => {
    setRows((prev) => {
      const hit = prev.find((r) => r.id === id);
      if (hit) URL.revokeObjectURL(hit.preview);
      return prev.filter((r) => r.id !== id);
    });
  };

  const rotate = (id: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, rotation: (((r.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : r)),
    );
  };

  /* HTML5 拖拽排序：放下时把拖动项插到目标项位置 */
  const onDropTo = (targetId: number) => {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    setOverId(null);
    if (fromId === null || fromId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === fromId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  async function run() {
    if (!rows.length) return;
    setBusy(true);
    setErr("");
    try {
      const data = await imagesToPdf(
        rows.map((r) => ({ blob: r.file, width: r.width, height: r.height, rotation: r.rotation })),
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
        <div className="ib-grid" style={{ marginTop: 14 }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="ib-card"
              draggable={!busy}
              onDragStart={(e) => {
                dragIdRef.current = r.id;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                dragIdRef.current = null;
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overId !== r.id) setOverId(r.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropTo(r.id);
              }}
              style={
                overId === r.id
                  ? { outline: "2px solid var(--accent)", outlineOffset: 2, cursor: "grabbing" }
                  : { cursor: "grab" }
              }
            >
              <img
                src={r.preview}
                alt={r.file.name}
                className="ib-thumb"
                style={{ transform: `rotate(${r.rotation}deg)`, transition: "transform 0.2s ease" }}
              />
              <div className="ib-meta">
                <span className="ib-name" title={r.file.name}>{i + 1}. {r.file.name}</span>
                <span className="ib-sub">
                  {r.width}×{r.height}{r.rotation ? ` · ${r.rotation}°` : ""}
                </span>
                <div className="vc-token-row" style={{ gap: 4, marginTop: 6 }}>
                  <button type="button" className="vc-icon-btn" onClick={() => move(i, -1)} title="上移" disabled={busy || i === 0}>
                    <IconArrowUp width={14} height={14} />
                  </button>
                  <button type="button" className="vc-icon-btn" onClick={() => move(i, 1)} title="下移" disabled={busy || i === rows.length - 1}>
                    <IconArrowDown width={14} height={14} />
                  </button>
                  <button type="button" className="vc-icon-btn" onClick={() => rotate(r.id)} title="旋转 90°" disabled={busy}>
                    <IconRotateCw width={14} height={14} />
                  </button>
                </div>
              </div>
              <button type="button" className="vc-icon-btn ib-del" onClick={() => remove(r.id)} title="移除" disabled={busy}>
                <IconTrash width={14} height={14} />
              </button>
            </div>
          ))}
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
