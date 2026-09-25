"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconDownload, IconImage, IconRefresh, IconShield } from "@/components/icons";

type Mode = "compress" | "resize" | "crop" | "convert";

const MODES: { id: Mode; label: string }[] = [
  { id: "compress", label: "压缩" },
  { id: "resize", label: "缩放" },
  { id: "crop", label: "裁剪" },
  { id: "convert", label: "转换" },
];

const FMTS = [
  { id: "image/jpeg", ext: "jpg" },
  { id: "image/webp", ext: "webp" },
  { id: "image/png", ext: "png" },
];

const RATIOS = [
  { id: "free", label: "自由" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "16:9", label: "16:9" },
];

/** 裁剪框：相对原图的百分比坐标 */
type Crop = { x: number; y: number; w: number; h: number };

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ImagePage() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [origSize, setOrigSize] = useState(0);
  const [mode, setMode] = useState<Mode>("compress");
  const [quality, setQuality] = useState(80);
  const [outFmt, setOutFmt] = useState("image/jpeg");
  const [tw, setTw] = useState(0);
  const [th, setTh] = useState(0);
  const [keepRatio, setKeepRatio] = useState(true);
  const [ratio, setRatio] = useState("free");
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 100, h: 100 });
  const [result, setResult] = useState<{ url: string; bytes: number; w: number; h: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { kind: "move" | "resize"; startX: number; startY: number; crop: Crop }>(null);

  const outExt = FMTS.find((f) => f.id === outFmt)?.ext ?? "png";

  // 图片加载
  const onFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setFileName(f.name);
      setOrigSize(f.size);
      setTw(im.naturalWidth);
      setTh(im.naturalHeight);
      setCrop({ x: 0, y: 0, w: 100, h: 100 });
      setResult(null);
    };
    im.src = url;
  }, []);

  // 渲染处理结果
  const runRender = useCallback(async () => {
    if (!img) return;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    let sx = 0, sy = 0, sw = w, sh = h;
    if (mode === "crop") {
      sw = Math.max(1, Math.round((crop.w / 100) * img.naturalWidth));
      sh = Math.max(1, Math.round((crop.h / 100) * img.naturalHeight));
      sx = Math.round((crop.x / 100) * img.naturalWidth);
      sy = Math.round((crop.y / 100) * img.naturalHeight);
      w = sw; h = sh;
    } else if (mode === "resize") {
      w = Math.max(1, tw || img.naturalWidth);
      h = Math.max(1, th || img.naturalHeight);
    } else {
      w = img.naturalWidth; h = img.naturalHeight;
    }
    c.width = w; c.height = h;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      c.toBlob(res, outFmt, quality / 100)
    );
    if (!blob) return;
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(blob), bytes: blob.size, w, h };
    });
  }, [img, mode, crop, tw, th, outFmt, quality]);

  // 参数变化自动渲染（防抖）
  useEffect(() => {
    if (!img) return;
    const t = setTimeout(() => void runRender(), 180);
    return () => clearTimeout(t);
  }, [img, mode, crop, tw, th, outFmt, quality, runRender]);

  // 等比联动：改宽自动算高
  const onWidth = (v: number) => {
    setTw(v);
    if (keepRatio && img) setTh(Math.max(1, Math.round((v / img.naturalWidth) * img.naturalHeight)));
  };
  const onHeight = (v: number) => {
    setTh(v);
    if (keepRatio && img) setTw(Math.max(1, Math.round((v / img.naturalHeight) * img.naturalWidth)));
  };

  // 裁剪框指针交互：框相对 stage 显示区域的像素坐标
  const applyRatio = (w: number, h: number) => {
    if (ratio === "1:1") return { w: Math.min(w, h), h: Math.min(w, h) };
    if (ratio === "4:3") {
      const r = 4 / 3;
      return w / h > r ? { w: h * r, h } : { w, h: w / r };
    }
    if (ratio === "16:9") {
      const r = 16 / 9;
      return w / h > r ? { w: h * r, h } : { w, h: w / r };
    }
    return { w, h };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current || !img) return;
    const el = stageRef.current;
    const rect = el.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;
    const fullBox = crop.w >= 99.9 && crop.h >= 99.9;
    const inBox = !fullBox && pctX >= crop.x && pctX <= crop.x + crop.w && pctY >= crop.y && pctY <= crop.y + crop.h;
    if (inBox) {
      setDrag({ kind: "move", startX: e.clientX, startY: e.clientY, crop });
    } else {
      const nw = Math.max(10, 100 - pctX);
      const nh = Math.max(10, 100 - pctY);
      const box = applyRatio(nw, nh);
      setCrop({ x: Math.min(pctX, 100 - box.w), y: Math.min(pctY, 100 - box.h), w: box.w, h: box.h });
      setDrag({ kind: "resize", startX: e.clientX, startY: e.clientY, crop: { x: Math.min(pctX, 100 - box.w), y: Math.min(pctY, 100 - box.h), w: box.w, h: box.h } });
    }
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !stageRef.current) return;
    const el = stageRef.current;
    const rect = el.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    const c = drag.crop;
    if (drag.kind === "move") {
      setCrop({
        x: Math.max(0, Math.min(100 - c.w, c.x + dx)),
        y: Math.max(0, Math.min(100 - c.h, c.y + dy)),
        w: c.w, h: c.h,
      });
    } else {
      let w = Math.max(5, c.w + dx);
      let h = Math.max(5, c.h + dy);
      const box = applyRatio(w, h);
      setCrop({ x: c.x, y: c.y, w: box.w, h: box.h });
    }
  };

  const onPointerUp = () => setDrag(null);

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${fileName.replace(/\.[^.]+$/, "") || "image"}.${outExt}`;
    a.click();
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="图片处理"
        lede="压缩 / 缩放 / 裁剪 / 格式转换"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="seg seg-wide" role="group" aria-label="处理模式">
          {MODES.map((m) => (
            <button key={m.id} data-active={mode === m.id} onClick={() => setMode(m.id)} type="button">
              {m.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />

        {!img ? (
          <div
            className="drop-zone clickable"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
          >
            <IconImage width={22} height={22} />
            <p>拖拽图片到这里，或点击选择</p>
            <p className="count-hint">支持 PNG / JPG / WebP / BMP / GIF，全程本地处理</p>
          </div>
        ) : (
          <>
            <div
              className={`img-stage ${mode === "crop" ? "crop-mode" : ""}`}
              ref={stageRef}
              onPointerDown={mode === "crop" ? onStagePointerDown : undefined}
              onPointerMove={mode === "crop" ? onPointerMove : undefined}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <img src={img.src} alt="原图预览" />
              {mode === "crop" && (
                <div
                  className="crop-box"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.w}%`,
                    height: `${crop.h}%`,
                  }}
                >
                  <span
                    className="crop-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDrag({ kind: "resize", startX: e.clientX, startY: e.clientY, crop });
                    }}
                    aria-label="调整裁剪框大小"
                  />
                </div>
              )}
              {mode === "crop" && (
                <p className="count-hint crop-hint">点击空白处新建裁剪框 · 拖动框体移动 · 拖右下角调整大小</p>
              )}
            </div>

            <div className="tool-row tool-row-wrap">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => inputRef.current?.click()}
                title="更换图片"
              >
                <IconRefresh width={14} height={14} />
                更换图片
              </button>
              {mode === "compress" && (
                <>
                  <label className="field-label">
                    质量 {quality}%
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                    />
                  </label>
                  <select
                    className="input"
                    value={outFmt}
                    onChange={(e) => setOutFmt(e.target.value)}
                    aria-label="输出格式"
                  >
                    {FMTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.ext.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {mode === "resize" && (
                <>
                  <div className="num-field">
                    <span>宽</span>
                    <input className="input" type="number" min={1} value={tw || ""} onChange={(e) => onWidth(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <div className="num-field">
                    <span>高</span>
                    <input className="input" type="number" min={1} value={th || ""} onChange={(e) => onHeight(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <label className="check-line">
                    <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
                    锁定比例
                  </label>
                  <select className="input" value={outFmt} onChange={(e) => setOutFmt(e.target.value)} aria-label="输出格式">
                    {FMTS.map((f) => (
                      <option key={f.id} value={f.id}>{f.ext.toUpperCase()}</option>
                    ))}
                  </select>
                </>
              )}
              {mode === "convert" && (
                <>
                  <label className="field-label">
                    目标格式
                    <select className="input" value={outFmt} onChange={(e) => setOutFmt(e.target.value)}>
                      {FMTS.map((f) => (
                        <option key={f.id} value={f.id}>{f.ext.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                  {outFmt !== "image/png" && (
                    <label className="field-label">
                      质量 {quality}%
                      <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                    </label>
                  )}
                </>
              )}
              {mode === "crop" && (
                <div className="seg" role="group" aria-label="裁剪比例">
                  {RATIOS.map((r) => (
                    <button key={r.id} data-active={ratio === r.id} onClick={() => setRatio(r.id)} type="button">
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-head">
              <span className="label">
                输出 · {result ? `${result.w} × ${result.h} · ${fmtSize(result.bytes)}` : "处理中…"}
                {result && (
                  <span className="count-hint">
                    {origSize ? `（原图 ${fmtSize(origSize)}，${(((result.bytes - origSize) / origSize) * 100).toFixed(0)}%）` : ""}
                  </span>
                )}
              </span>
              <span className="right">
                <button className="btn btn-primary btn-sm" onClick={download} type="button" disabled={!result}>
                  <IconDownload width={14} height={14} />
                  下载 .{outExt}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
