"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconScan, IconTrash, IconLoader, IconUpload, IconCopy, IconFile, IconFileStack } from "@/components/icons";

type FileKind = "image" | "pdf" | "docx";
interface FileItem {
  file: File;
  kind: FileKind;
  preview?: string; /* 图片 objectURL */
}

const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;

/* ---------- pdf.js 懒加载 ---------- */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

/* ---------- PaddleOCR.js 懒加载（pixpin 同源引擎，中文最准） ---------- */
type OcrEngine = { predict: (input: unknown) => Promise<{ items?: { text: string }[] }[]> };
let ocrPromise: Promise<OcrEngine> | null = null;
async function getOcr() {
  if (!ocrPromise) {
    ocrPromise = import("@paddleocr/paddleocr-js").then(({ PaddleOCR }) =>
      PaddleOCR.create({
        lang: "ch",
        ocrVersion: "PP-OCRv5",
        ortOptions: { backend: "wasm", wasmPaths: "/onnx/" },
      }),
    );
  }
  return ocrPromise;
}

/* 把一组 OcrResult 组装成带分页标记的文本 */
function assemble(itemsArr: { items?: { text: string }[] }[], pageLabel: (i: number) => string): string {
  const lines: string[] = [];
  itemsArr.forEach((res, i) => {
    const texts = (res.items ?? []).map((it) => it.text).filter(Boolean);
    if (texts.length === 0) return;
    lines.push(`===== ${pageLabel(i)} =====`);
    lines.push(texts.join("\n"));
  });
  return lines.join("\n");
}

export default function OcrPage() {
  const [item, setItem] = useState<FileItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  /* docx 预览容器 */
  const [docxPreview, setDocxPreview] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docxHostRef = useRef<HTMLDivElement>(null);
  const pdfCanvasHostRef = useRef<HTMLDivElement>(null);

  const setFile = useCallback((f: File) => {
    setDocxPreview(null);
    if (docxHostRef.current) docxHostRef.current.innerHTML = "";
    if (pdfCanvasHostRef.current) pdfCanvasHostRef.current.innerHTML = "";
    setItem((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      const kind: FileKind = PDF_EXT.test(f.name) ? "pdf" : DOCX_EXT.test(f.name) ? "docx" : "image";
      return { file: f, kind, preview: kind === "image" ? URL.createObjectURL(f) : undefined };
    });
    setText("");
    setErr("");
  }, []);

  useEffect(() => {
    return () => {
      if (item?.preview) URL.revokeObjectURL(item.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    setItem((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      return null;
    });
    setDocxPreview(null);
    if (docxHostRef.current) docxHostRef.current.innerHTML = "";
    if (pdfCanvasHostRef.current) pdfCanvasHostRef.current.innerHTML = "";
    setText("");
    setErr("");
  };

  /* ---------- PDF → canvas 数组（scale 2 保证识别清晰） ---------- */
  const pdfToCanvases = async (file: File): Promise<HTMLCanvasElement[]> => {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
    const canvases: HTMLCanvasElement[] = [];
    const host = pdfCanvasHostRef.current!;
    host.innerHTML = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = "display:none;";
      host.appendChild(canvas);
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
      page.cleanup();
    }
    return canvases;
  };

  /* ---------- docx → 渲染 + 提取文本 + 内嵌图片 ---------- */
  const docxRecognize = async (file: File, ocr: OcrEngine) => {
    const host = docxHostRef.current!;
    host.innerHTML = "";
    const frag = document.createElement("div");
    host.appendChild(frag);
    const { renderAsync } = await import("docx-preview");
    await renderAsync(file.arrayBuffer ? await file.arrayBuffer() : file, frag, undefined, {
      inWrapper: true,
      ignoreLastRenderedPageBreak: true,
      useBase64URL: true,
      breakPages: false,
    });
    setDocxPreview(frag);
    /* 1) 渲染 DOM 的文本（docx 本质是文字，直接读最准） */
    const domText = (frag.innerText || "").trim();
    /* 2) 内嵌图片走 PaddleOCR（扫描图） */
    const imgs = Array.from(frag.querySelectorAll<HTMLImageElement>("img")).filter(
      (im) => im.naturalWidth > 0,
    );
    let imgTexts: { text: string }[] = [];
    if (imgs.length) {
      const results = await ocr.predict(imgs);
      imgTexts = (results[0]?.items ?? []).map((it) => ({ text: it.text }));
    }
    return { domText, imgTexts, imgCount: imgs.length };
  };

  const run = async () => {
    if (!item) return;
    setBusy(true);
    setErr("");
    setText("");
    setStage("加载识别引擎（首次需下载模型）…");
    try {
      const ocr = await getOcr();
      if (item.kind === "image") {
        setStage("正在识别图片…");
        const results = await ocr.predict(item.file);
        setText(assemble(results, () => "识别结果"));
      } else if (item.kind === "pdf") {
        setStage("正在渲染 PDF 页面…");
        const canvases = await pdfToCanvases(item.file);
        setStage(`正在识别 ${canvases.length} 页…`);
        const results = await ocr.predict(canvases);
        setText(assemble(results, (i) => `第 ${i + 1} 页`));
      } else {
        setStage("正在渲染 Word 文档…");
        const { domText, imgTexts, imgCount } = await docxRecognize(item.file, ocr);
        const parts: string[] = [];
        if (domText) parts.push(domText);
        if (imgTexts.length) {
          parts.push(
            `\n===== 文档内嵌图片识别（${imgCount} 张）=====`,
            imgTexts.map((t) => t.text).join("\n"),
          );
        }
        setText(parts.join("\n\n"));
      }
      setStage("识别完成");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "识别失败");
      setStage("");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr("复制失败，请手动选择文本复制");
    }
  };

  const accept = ".png,.jpg,.jpeg,.webp,.bmp,.gif,.pdf,.docx";

  return (
    <div className="fade-rise">
      <ToolHead
        title="OCR 文字识别"
        lede="图片 / PDF / Word 文字识别 — PaddleOCR 引擎（PixPin 同源），中文更准，浏览器本地运行，文件不上传"
        chip={
          <span>
            <IconScan width={12} height={12} />
            本地识别 · 隐私安全
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">文件</span>
          <span className="right subtle">支持图片 / PDF / Word(docx)</span>
        </div>
        <div className="panel-body">
          {!item ? (
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
                const f = Array.from(e.dataTransfer.files).find(
                  (x) => IMG_EXT.test(x.name) || PDF_EXT.test(x.name) || DOCX_EXT.test(x.name),
                );
                if (f) setFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload width={22} height={22} />
              <span>点击或拖拽图片 / PDF / Word 到此处</span>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="ocr-preview">
              {item.kind === "image" && item.preview && (
                <img src={item.preview} alt={item.file.name} className="ocr-img" />
              )}
              {item.kind !== "image" && (
                <div className="ocr-file-card">
                  {item.kind === "pdf" ? <IconFileStack width={26} height={26} /> : <IconFile width={26} height={26} />}
                  <div className="ocr-file-info">
                    <div className="ocr-file-name">{item.file.name}</div>
                    <div className="subtle">{(item.file.size / 1024).toFixed(0)} KB · {item.kind === "pdf" ? "PDF 文档" : "Word 文档"}</div>
                  </div>
                </div>
              )}
              {/* docx 渲染预览（可见） */}
              {item.kind === "docx" && (
                <div className="ocr-docx-wrap">
                  <div className="subtle" style={{ marginBottom: 6 }}>Word 渲染预览：</div>
                  <div ref={docxHostRef} className="ocr-docx-host" />
                </div>
              )}
              {/* pdf 渲染 canvas 宿主（隐藏，仅用于识别） */}
              <div ref={pdfCanvasHostRef} style={{ display: "none" }} />

              <div className="vc-token-row">
                <span className="subtle">{item.file.name}（{(item.file.size / 1024).toFixed(0)} KB）</span>
                <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  更换文件
                </button>
                <button type="button" className="vc-icon-btn" onClick={clear} disabled={busy} title="移除">
                  <IconTrash />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !item}>
          {busy ? <IconLoader width={14} height={14} /> : null}
          {busy ? "识别中…" : "开始识别"}
        </button>
      </div>

      {busy && stage && (
        <div className="vd-progress">
          <div className="vd-progress-text">{stage}</div>
          <div className="vd-progress-bar vd-progress-indet">
            <div className="vd-progress-fill" />
          </div>
        </div>
      )}

      {err && <div className="vc-log-error">{err}</div>}

      {text && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <span className="label">识别结果</span>
            <button type="button" className="vc-link" onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconCopy width={12} height={12} />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="panel-body">
            <pre className="ocr-result">{text}</pre>
          </div>
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>识别在浏览器本地完成，文件不上传服务器。
        引擎为 PaddleOCR（PixPin 同源，中文 / 英文混合识别，首次需下载模型约 20MB，之后浏览器缓存）。
        图片、PDF 走 OCR 识别；Word(docx) 直接提取文档文字（更准确），内嵌扫描图单独识别。
        建议使用清晰的截图或扫描件，识别效果最佳。
      </div>
    </div>
  );
}
