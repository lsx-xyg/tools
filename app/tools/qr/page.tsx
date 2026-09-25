"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { ToolHead } from "@/components/tool-head";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconImage,
  IconQr,
  IconScan,
  IconShield,
  IconUpload,
} from "@/components/icons";

const SIZES = [256, 512, 1024];
type Mode = "generate" | "decode";

export default function QrPage() {
  const [mode, setMode] = useState<Mode>("generate");

  /* ========== 生成 ========== */
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState("#23201a");
  const [bg, setBg] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [genErr, setGenErr] = useState("");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number>(0);

  const schedule = useCallback(
    (q: string) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const content = q.trim();
        if (!content) {
          setDataUrl(null);
          setGenErr("");
          return;
        }
        QRCode.toDataURL(content, {
          width: size,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: fg, light: bg },
        })
          .then((url) => {
            setDataUrl(url);
            setGenErr("");
          })
          .catch(() => setGenErr("生成失败，请检查内容长度"));
      }, 300);
    },
    [size, fg, bg],
  );

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function copyQr() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  /* ========== 解析 ========== */
  const [result, setResult] = useState("");
  const [decErr, setDecErr] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [decCopied, setDecCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function decodeFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setDecErr("请上传图片文件（PNG / JPG / WebP 等）");
      return;
    }
    setDecErr("");
    setResult("");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 不可用");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (code && code.data) {
        setResult(code.data);
      } else {
        setDecErr("未识别到二维码，请确保图片清晰、二维码完整且正对镜头");
      }
    } catch {
      setDecErr("图片解析失败，请换一张试试");
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void decodeFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void decodeFile(f);
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setDecCopied(true);
      setTimeout(() => setDecCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="二维码生成 / 解析"
        lede="文本 / 链接转二维码，或上传二维码图片解析内容"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地处理 · 不上传
          </span>
        }
      />

      {/* 模式切换 */}
      <div className="seg seg-wide" role="group" aria-label="二维码模式">
        <button data-active={mode === "generate"} onClick={() => setMode("generate")} type="button">
          <IconQr width={14} height={14} />
          生成
        </button>
        <button data-active={mode === "decode"} onClick={() => setMode("decode")} type="button">
          <IconScan width={14} height={14} />
          解析
        </button>
      </div>

      {/* ========== 生成模式 ========== */}
      {mode === "generate" && (
        <>
          <div className="info-hint">
            <IconShield width={13} height={13} />
            <span>
              微信扫码：网址（https 链接）可正常打开；纯文本、Wi-Fi 等非网址内容微信可能提示「暂不支持展示」——这是微信内置扫码器的限制，请改用系统相机、支付宝或浏览器扫码。
            </span>
          </div>

          <div className="transfer-grid qr-grid">
            <section className="panel">
              <div className="panel-head">
                <span className="label">内容</span>
                <span className="count-hint">{text.length} 字符</span>
              </div>
              <div className="panel-body">
                <textarea
                  className="input textarea tall"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    schedule(e.target.value);
                  }}
                  placeholder="输入文本、链接、Wi-Fi 配置（wifi:T:WPA;S:名称;P:密码;;）等任意内容…"
                  spellCheck={false}
                />
                <div className="qr-opts">
                  <div>
                    <span className="count-hint">尺寸</span>
                    <div className="seg" role="group" aria-label="二维码尺寸">
                      {SIZES.map((s) => (
                        <button
                          key={s}
                          data-active={size === s}
                          onClick={() => {
                            setSize(s);
                            schedule(text);
                          }}
                          type="button"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="qr-colors">
                    <label className="count-hint">
                      前景
                      <input
                        type="color"
                        value={fg}
                        onChange={(e) => {
                          setFg(e.target.value);
                          schedule(text);
                        }}
                      />
                    </label>
                    <label className="count-hint">
                      背景
                      <input
                        type="color"
                        value={bg}
                        onChange={(e) => {
                          setBg(e.target.value);
                          schedule(text);
                        }}
                      />
                    </label>
                  </div>
                </div>
                {genErr && <p className="count-hint warn" style={{ marginTop: 10 }}>{genErr}</p>}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <span className="label">预览</span>
                <span className="right">
                  {dataUrl && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void copyQr()}
                        type="button"
                        disabled={copied}
                      >
                        {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                        {copied ? "已复制" : "复制"}
                      </button>
                      <a className="btn btn-primary btn-sm" href={dataUrl} download="qr.png">
                        <IconDownload width={14} height={14} />
                        下载 PNG
                      </a>
                    </>
                  )}
                </span>
              </div>
              <div className="panel-body qr-preview">
                {dataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={dataUrl}
                    alt="生成的二维码"
                    width={size}
                    height={size}
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                ) : (
                  <div className="qr-empty">输入内容后自动生成</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ========== 解析模式 ========== */}
      {mode === "decode" && (
        <div className="transfer-grid qr-grid">
          {/* 左：上传 */}
          <section className="panel">
            <div className="panel-head">
              <span className="label">上传二维码图片</span>
            </div>
            <div className="panel-body">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onFilePick}
              />
              <div
                className={`drop-zone clickable ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt="待解析的二维码"
                    style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }}
                  />
                ) : (
                  <>
                    <IconUpload width={22} height={22} />
                    <p>拖拽二维码图片到这里，或点击选择</p>
                    <p className="count-hint">支持 PNG / JPG / WebP 等，全程本地解析</p>
                  </>
                )}
              </div>
              {previewUrl && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <IconImage width={14} height={14} />
                  重新选择
                </button>
              )}
            </div>
          </section>

          {/* 右：结果 */}
          <section className="panel">
            <div className="panel-head">
              <span className="label">解析结果</span>
              <span className="right">
                {result && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void copyResult()}
                    type="button"
                    disabled={decCopied}
                  >
                    {decCopied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                    {decCopied ? "已复制" : "复制"}
                  </button>
                )}
              </span>
            </div>
            <div className="panel-body">
              {decErr ? (
                <p className="count-hint warn">{decErr}</p>
              ) : result ? (
                <textarea
                  className="input textarea tall"
                  value={result}
                  readOnly
                  spellCheck={false}
                />
              ) : (
                <div className="qr-empty">
                  <IconScan width={22} height={22} />
                  <p>上传二维码图片后自动解析</p>
                </div>
              )}
              {result && (
                <p className="count-hint" style={{ marginTop: 10 }}>
                  共 {result.length} 字符
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
