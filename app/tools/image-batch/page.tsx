"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { ToolHead } from "@/components/tool-head";
import { IconImage, IconDrop, IconTrash, IconDownload, IconLoader, IconUpload, IconFile, IconArrowUp, IconArrowDown } from "@/components/icons";

type TabId = "compress" | "watermark" | "topdf";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "compress", label: "批量压缩", icon: <IconImage width={15} height={15} /> },
  { id: "watermark", label: "加水印", icon: <IconDrop width={15} height={15} /> },
  { id: "topdf", label: "转 PDF", icon: <IconFile width={15} height={15} /> },
];

const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

interface ImageRow {
  file: File;
  preview: string;
  width: number;
  height: number;
  size: number;
}

interface OutFile {
  name: string;
  url: string;
  size: number;
}

/* 加载图片为 canvas（限制长边避免超大内存） */
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

export default function ImageBatchPage() {
  const [tab, setTab] = useState<TabId>("compress");
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [outputs, setOutputs] = useState<OutFile[]>([]);

  /* 压缩参数 */
  const [quality, setQuality] = useState(0.8);
  const [scale, setScale] = useState(100);

  /* 水印参数 */
  const [wmText, setWmText] = useState("");
  const [wmPos, setWmPos] = useState("br");
  const [wmSize, setWmSize] = useState(5);
  const [wmOpacity, setWmOpacity] = useState(60);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  /* 转 PDF 参数 */
  const [pageSize, setPageSize] = useState<"a4" | "a3" | "original">("a4");
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) => IMG_EXT.test(f.name));
      if (!arr.length) {
        setMsg("请选择图片文件（png / jpg / webp / gif / bmp 等）。");
        return;
      }
      const next: ImageRow[] = [...rows];
      for (const f of arr) {
        if (next.length >= 30) break;
        try {
          const { img, url } = await loadImage(f);
          next.push({ file: f, preview: url, width: img.naturalWidth, height: img.naturalHeight, size: f.size });
        } catch (e) {
          setMsg(e instanceof Error ? e.message : "图片读取失败");
        }
      }
      setRows(next);
    },
    [rows]
  );

  const removeFile = (name: string) => {
    setRows((prev) => {
      const hit = prev.find((r) => r.file.name === name);
      if (hit) URL.revokeObjectURL(hit.preview);
      return prev.filter((r) => r.file.name !== name);
    });
  };

  useEffect(() => {
    return () => {
      rows.forEach((r) => URL.revokeObjectURL(r.preview));
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () => {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    setRows([]);
    setMsg("");
    setOutputs((prev) => {
      prev.forEach((o) => URL.revokeObjectURL(o.url));
      return [];
    });
  };

  const switchTab = (id: TabId) => {
    setTab(id);
    clearAll();
  };

  const downloadOne = (canvas: HTMLCanvasElement, ext: string, nameBase: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("图片编码失败"));
        },
        ext === "png" ? "image/png" : "image/jpeg",
        ext === "png" ? undefined : quality
      );
    });
  };

  const runCompress = async () => {
    if (!rows.length) return;
    setBusy(true);
    setMsg("正在压缩…");
    setOutputs([]);
    try {
      const zip = new JSZip();
      const folder = zip.folder("compressed")!;
      let done = 0;
      for (const row of rows) {
        const { img, url } = await loadImage(row.file);
        const scaleW = Math.max(1, Math.round(row.width * (scale / 100)));
        const scaleH = Math.max(1, Math.round(row.height * (scale / 100)));
        const canvas = document.createElement("canvas");
        canvas.width = scaleW;
        canvas.height = scaleH;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, scaleW, scaleH);
        URL.revokeObjectURL(url);
        const isPng = /\.png$/i.test(row.file.name) && scale === 100;
        const ext = isPng ? "png" : "jpg";
        const blob = await downloadOne(canvas, ext, row.file.name.replace(/\.[^.]+$/, ""));
        const outName = row.file.name.replace(/\.[^.]+$/, "") + `_compressed.${ext}`;
        folder.file(outName, blob);
        canvas.width = 0;
        canvas.height = 0;
        done++;
        setMsg(`正在压缩… ${done}/${rows.length}`);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipName = `images_compressed_${Date.now()}.zip`;
      setOutputs([{ name: zipName, url: URL.createObjectURL(zipBlob), size: zipBlob.size }]);
      setMsg(`完成：${done} 张图片已压缩打包。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "压缩失败");
    } finally {
      setBusy(false);
    }
  };

  const runWatermark = async () => {
    if (!rows.length) return;
    if (!wmText.trim() && !logoFile) {
      setMsg("请填写水印文字或上传水印图片。");
      return;
    }
    setBusy(true);
    setMsg("正在添加水印…");
    setOutputs([]);
    try {
      const logo = logoFile ? await loadImage(logoFile) : null;
      const zip = new JSZip();
      const folder = zip.folder("watermarked")!;
      let done = 0;
      for (const row of rows) {
        const { img, url } = await loadImage(row.file);
        const canvas = document.createElement("canvas");
        canvas.width = row.width;
        canvas.height = row.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const margin = Math.round(row.width * 0.02);
        let x: number, y: number;
        if (logo && logo.img) {
          const lw = Math.round(row.width * (wmSize / 10));
          const lh = Math.round(logo.img.naturalHeight * (lw / logo.img.naturalWidth));
          ctx.globalAlpha = wmOpacity / 100;
          const pos = wmPos;
          const px = pos.includes("l") ? margin : pos.includes("r") ? row.width - margin - lw : (row.width - lw) / 2;
          const py = pos.includes("t") ? margin : pos.includes("b") ? row.height - margin - lh : (row.height - lh) / 2;
          ctx.drawImage(logo.img, px, py, lw, lh);
          x = px;
          y = py;
        } else {
          const fontPx = Math.round(row.width * (wmSize / 100));
          ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
          ctx.globalAlpha = wmOpacity / 100;
          const tw = ctx.measureText(wmText).width;
          const th = fontPx;
          const pos = wmPos;
          const px = pos.includes("l") ? margin : pos.includes("r") ? row.width - margin - tw : (row.width - tw) / 2;
          const py = pos.includes("t") ? margin + th : pos.includes("b") ? row.height - margin : (row.height + th) / 2;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(wmText, px, py);
          ctx.fillStyle = "rgba(0,0,0,0.9)";
          ctx.fillText(wmText, px + Math.max(1, Math.round(fontPx / 40)), py + Math.max(1, Math.round(fontPx / 40)));
          x = px;
          y = py;
        }
        void x;
        void y;
        ctx.globalAlpha = 1;

        const ext = /\.png$/i.test(row.file.name) ? "png" : "jpg";
        const blob = await downloadOne(canvas, ext, row.file.name.replace(/\.[^.]+$/, ""));
        folder.file(row.file.name.replace(/\.[^.]+$/, "") + `_watermarked.${ext}`, blob);
        canvas.width = 0;
        canvas.height = 0;
        done++;
        setMsg(`正在添加水印… ${done}/${rows.length}`);
      }
      if (logo) URL.revokeObjectURL(logo.url);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipName = `images_watermarked_${Date.now()}.zip`;
      setOutputs([{ name: zipName, url: URL.createObjectURL(zipBlob), size: zipBlob.size }]);
      setMsg(`完成：${done} 张图片已加水印打包。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "水印处理失败");
    } finally {
      setBusy(false);
    }
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    setRows((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const runToPdf = async () => {
    if (!rows.length) return;
    setBusy(true);
    setMsg("正在生成 PDF…");
    setOutputs([]);
    try {
      const doc = await PDFDocument.create();
      for (const row of rows) {
        const { img, url } = await loadImage(row.file);
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        /* 目标页面尺寸（pt）：A4 / A3 自适应横竖，原图尺寸按 1px = 0.75pt */
        let pageW: number;
        let pageH: number;
        if (pageSize === "original") {
          pageW = imgW * 0.75;
          pageH = imgH * 0.75;
          const maxSide = Math.max(pageW, pageH);
          if (maxSide > 14400) {
            const s = 14400 / maxSide;
            pageW *= s;
            pageH *= s;
          }
        } else {
          const baseW = pageSize === "a4" ? 595.28 : 841.89;
          const baseH = pageSize === "a4" ? 841.89 : 1190.55;
          pageW = imgW > imgH ? baseH : baseW;
          pageH = imgW > imgH ? baseW : baseH;
        }
        /* 在 canvas 上铺白底并绘制（contain 留白 / cover 裁剪），再整页嵌入 PDF */
        const pxW = Math.max(1, Math.round(pageW / 0.75));
        const pxH = Math.max(1, Math.round(pageH / 0.75));
        const canvas = document.createElement("canvas");
        canvas.width = pxW;
        canvas.height = pxH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pxW, pxH);
        ctx.imageSmoothingQuality = "high";
        if (fitMode === "contain") {
          const margin = pageSize === "original" ? 0 : 24;
          const s = Math.min((pxW - margin * 2) / imgW, (pxH - margin * 2) / imgH);
          const cw = imgW * s;
          const ch = imgH * s;
          ctx.drawImage(img, (pxW - cw) / 2, (pxH - ch) / 2, cw, ch);
        } else {
          const s = Math.max(pxW / imgW, pxH / imgH);
          const dw = imgW * s;
          const dh = imgH * s;
          ctx.drawImage(img, (pxW - dw) / 2, (pxH - dh) / 2, dw, dh);
        }
        URL.revokeObjectURL(url);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("图片编码失败"))), "image/jpeg", 0.92)
        );
        canvas.width = 0;
        canvas.height = 0;
        const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const page = doc.addPage([pageW, pageH]);
        page.drawImage(jpg, { x: 0, y: 0, width: pageW, height: pageH });
      }
      const pdfBytes = await doc.save();
      const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      setOutputs([{ name: `images_${Date.now()}.pdf`, url: URL.createObjectURL(pdfBlob), size: pdfBlob.size }]);
      setMsg(`完成：${rows.length} 张图片已合并为一个 PDF。`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "PDF 生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="图片批量处理"
        lede="批量压缩 · 批量加水印 · 图片转 PDF — 全部本地处理，图片不上传"
        chip={
          <span>
            <IconImage width={12} height={12} />
            本地处理 · 隐私安全
          </span>
        }
      />

      <div className="hp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => switchTab(t.id)}
            type="button"
            className="hp-tab"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">图片文件</span>
          <span className="right subtle">最多 30 张</span>
        </div>
        <div className="panel-body">
          <div
            className={`vd-dropzone ${dragging ? "vd-dropzone-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload width={22} height={22} />
            <span>点击或拖拽图片到此处（可多选）</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {rows.length > 0 && (
            <div className="ib-grid">
              {rows.map((r, i) => (
                <div key={r.file.name} className="ib-card">
                  <img src={r.preview} alt={r.file.name} className="ib-thumb" />
                  <div className="ib-meta">
                    <span className="ib-name" title={r.file.name}>
                      {r.file.name}
                    </span>
                    <span className="ib-sub">
                      {r.width}×{r.height} · {(r.size / 1024).toFixed(0)} KB
                    </span>
                    <div className="vc-token-row" style={{ gap: 4, marginTop: 6 }}>
                      <button type="button" className="vc-icon-btn" onClick={() => moveRow(i, -1)} title="上移（靠前）" disabled={busy || i === 0}>
                        <IconArrowUp width={14} height={14} />
                      </button>
                      <button type="button" className="vc-icon-btn" onClick={() => moveRow(i, 1)} title="下移（靠后）" disabled={busy || i === rows.length - 1}>
                        <IconArrowDown width={14} height={14} />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="vc-icon-btn ib-del" onClick={() => removeFile(r.file.name)} title="移除">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "compress" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">压缩质量（0.1 ~ 1，越低越小）</label>
                <input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} disabled={busy} style={{ width: "100%" }} />
                <span className="vc-hint">{Math.round(quality * 100)}%</span>
              </div>
              <div className="vd-field">
                <label className="vc-label">缩放比例</label>
                <select className="input" value={scale} onChange={(e) => setScale(parseInt(e.target.value))} disabled={busy}>
                  <option value="100">100%（原尺寸）</option>
                  <option value="75">75%</option>
                  <option value="50">50%</option>
                  <option value="25">25%</option>
                  <option value="10">10%</option>
                </select>
              </div>
            </div>
          )}

          {tab === "watermark" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">水印文字</label>
                <input className="input" placeholder="如 © yourname" value={wmText} onChange={(e) => setWmText(e.target.value)} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">或上传水印图片（PNG 带透明底最佳）</label>
                <div className="vc-token-row">
                  <button type="button" className="btn" onClick={() => logoInputRef.current?.click()} disabled={busy}>
                    选择水印图
                  </button>
                  <span className="subtle">{logoFile ? logoFile.name : "未选择"}</span>
                  {logoFile && (
                    <button type="button" className="vc-link" onClick={() => setLogoFile(null)} disabled={busy}>
                      移除
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="vd-field">
                <label className="vc-label">水印位置</label>
                <select className="input" value={wmPos} onChange={(e) => setWmPos(e.target.value)} disabled={busy}>
                  <option value="tl">左上</option>
                  <option value="tc">上中</option>
                  <option value="tr">右上</option>
                  <option value="cl">左中</option>
                  <option value="cc">居中</option>
                  <option value="cr">右中</option>
                  <option value="bl">左下</option>
                  <option value="bc">下中</option>
                  <option value="br">右下</option>
                </select>
              </div>
              <div className="vd-field">
                <label className="vc-label">水印大小（占图片宽度 %）</label>
                <input type="number" min={1} max={50} className="input" value={wmSize} onChange={(e) => setWmSize(Math.max(1, Math.min(50, parseFloat(e.target.value) || 5)))} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">不透明度（% {wmOpacity}）</label>
                <input type="range" min={5} max={100} step={5} value={wmOpacity} onChange={(e) => setWmOpacity(parseInt(e.target.value))} disabled={busy} style={{ width: "100%" }} />
              </div>
            </div>
          )}
          {tab === "topdf" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">页面尺寸</label>
                <select className="input" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "a3" | "original")} disabled={busy}>
                  <option value="a4">A4（自动横竖）</option>
                  <option value="a3">A3（自动横竖）</option>
                  <option value="original">原图尺寸</option>
                </select>
              </div>
              <div className="vd-field">
                <label className="vc-label">图片缩放</label>
                <select className="input" value={fitMode} onChange={(e) => setFitMode(e.target.value as "contain" | "cover")} disabled={busy}>
                  <option value="contain">适应页面（留白）</option>
                  <option value="cover">填满页面（裁剪边缘）</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" className="btn btn-primary" onClick={tab === "compress" ? runCompress : tab === "watermark" ? runWatermark : runToPdf} disabled={busy || !rows.length}>
          {busy ? <IconLoader width={14} height={14} /> : null}
          {busy ? "处理中…" : tab === "compress" ? "压缩并打包 ZIP" : tab === "watermark" ? "添加水印并打包 ZIP" : "合并为 PDF"}
        </button>
        <button type="button" className="btn" onClick={clearAll} disabled={busy}>
          清空
        </button>
      </div>

      {msg && <div className="vc-note">{msg}</div>}

      {outputs.length > 0 && (
        <div className="vd-outputs">
          {outputs.map((o) => (
            <div key={o.name} className="vd-output">
              <span className="vd-output-name">
                {o.name}（{(o.size / 1024 / 1024).toFixed(2)} MB）
              </span>
              <a className="btn btn-primary" href={o.url} download={o.name}>
                <IconDownload width={14} height={14} />
                下载
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>全部在浏览器本地用 Canvas 处理，图片不上传服务器。
        透明 PNG 在压缩时保留 PNG 格式，其余转 JPEG；转 PDF 时按列表顺序合并为一页一张，可用卡片上的 ↑ / ↓ 调整顺序。
      </div>
    </div>
  );
}
