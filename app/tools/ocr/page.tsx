"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconScan, IconTrash, IconLoader, IconUpload, IconCopy } from "@/components/icons";

type Lang = "chi_sim" | "eng" | "chi_sim+eng";

declare global {
  interface Window {
    Tesseract?: {
      createWorker: (langs: string, oem: number, opts: { workerPath?: string; corePath?: string; langPath?: string; logger?: (m: { status: string; progress: number }) => void }) => Promise<{
        recognize: (image: Blob) => Promise<{ data: { text: string } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

export default function OcrPage() {
  const [img, setImg] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lang, setLang] = useState<Lang>("chi_sim");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setFile = useCallback((f: File) => {
    setImg(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setText("");
    setErr("");
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`加载脚本失败：${src}`));
      document.head.appendChild(s);
    });

  const run = async () => {
    if (!img) return;
    setBusy(true);
    setErr("");
    setText("");
    setProgress(0);
    setStatus("正在加载识别引擎…");
    try {
      if (!window.Tesseract) await loadScript("/tesseract/tesseract.min.js");
      setStatus("正在加载语言数据（首次需下载）…");
      const worker = await window.Tesseract!.createWorker(lang, 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/tesseract-core.wasm.js",
        langPath: "/tesseract/lang/",
        logger: (m) => {
          if (typeof m.progress === "number") setProgress(m.progress);
          if (m.status) setStatus(m.status);
        },
      });
      setStatus("正在识别…");
      const { data } = await worker.recognize(img);
      setText(data.text);
      setStatus("识别完成");
      await worker.terminate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "识别失败");
      setStatus("");
    } finally {
      setBusy(false);
      setProgress(0);
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

  return (
    <div className="fade-rise">
      <ToolHead
        title="OCR 文字识别"
        lede="图片文字识别（简体中文 / English）— tesseract.js 在浏览器本地运行，图片不上传"
        chip={
          <span>
            <IconScan width={12} height={12} />
            本地识别 · 隐私安全
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">图片</span>
          <span className="right subtle">支持 png / jpg / webp / bmp</span>
        </div>
        <div className="panel-body">
          {!img ? (
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
                const f = Array.from(e.dataTransfer.files).find((x) => IMG_EXT.test(x.name));
                if (f) setFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload width={22} height={22} />
              <span>点击或拖拽图片到此处</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="ocr-preview">
              <img src={preview} alt={img.name} className="ocr-img" />
              <div className="vc-token-row">
                <span className="subtle">{img.name}（{(img.size / 1024).toFixed(0)} KB）</span>
                <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  更换图片
                </button>
                <button
                  type="button"
                  className="vc-icon-btn"
                  onClick={() => {
                    setImg(null);
                    setPreview((p) => {
                      if (p) URL.revokeObjectURL(p);
                      return "";
                    });
                    setText("");
                    setErr("");
                  }}
                  title="移除"
                  disabled={busy}
                >
                  <IconTrash />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

          <div className="vd-grid" style={{ marginTop: 12 }}>
            <div className="vd-field">
              <label className="vc-label">识别语言</label>
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang)} disabled={busy}>
                <option value="chi_sim">简体中文</option>
                <option value="eng">English</option>
                <option value="chi_sim+eng">中英混合</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !img}>
          {busy ? <IconLoader width={14} height={14} /> : null}
          {busy ? "识别中…" : "开始识别"}
        </button>
      </div>

      {busy && (
        <div className="vd-progress">
          <div className="vd-progress-bar">
            <div className="vd-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="vd-progress-text">{status ? `${status} ${Math.round(progress * 100)}%` : `${Math.round(progress * 100)}%`}</div>
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
        <strong>说明：</strong>识别在浏览器本地用 tesseract.js 完成，图片不上传服务器。
        首次识别需下载语言数据（简体中文约 4MB / English 约 10MB），之后浏览器缓存。
        建议使用清晰的截图或扫描件，识别效果最佳。
      </div>
    </div>
  );
}
