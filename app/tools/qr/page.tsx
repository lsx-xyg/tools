"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconDownload, IconShield } from "@/components/icons";

const SIZES = [256, 512, 1024];

export default function QrPage() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState("#23201a");
  const [bg, setBg] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number>(0);

  // 事件驱动防抖生成（输入/选项变化都走这里，避免 effect 内 setState）
  const schedule = useCallback(
    (q: string) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const content = q.trim();
        if (!content) {
          setDataUrl(null);
          setErr("");
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
            setErr("");
          })
          .catch(() => setErr("生成失败，请检查内容长度"));
      }, 300);
    },
    [size, fg, bg],
  );

  // 卸载时清理定时器
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function copyQr() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不支持图片时忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="二维码生成"
        lede="文本 / 链接转二维码，扫码即得"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地生成 · 不上传
          </span>
        }
      />

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
            {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}
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
                  <a
                    className="btn btn-primary btn-sm"
                    href={dataUrl}
                    download="qr.png"
                  >
                    <IconDownload width={14} height={14} />
                    下载 PNG
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="panel-body qr-preview">
            {dataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- QR 为本地 dataURL，无需 Next 优化 */
              <img src={dataUrl} alt="生成的二维码" width={size} height={size} style={{ maxWidth: "100%", height: "auto" }} />
            ) : (
              <div className="qr-empty">输入内容后自动生成</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
