"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { IconScan, IconX } from "../icons";

/**
 * 扫一扫：调用摄像头识别发送端二维码中的 6 位提取码。
 * 用 jsQR 纯 JS 解码（iOS Safari 无 BarcodeDetector 也能用），
 * 识别成功后自动回填并加入传输。
 */
export function ScannerButton({ onDetected }: { onDetected(code: string): void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  }

  async function start() {
    setErr("");
    doneRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(tick);
    } catch {
      setErr("无法打开摄像头：请检查权限，或改用系统浏览器打开网页扫码");
    }
  }

  function tick() {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    ctx.drawImage(video, 0, 0);
    try {
      const img = ctx.getImageData(0, 0, w, h);
      const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (res?.data && !doneRef.current) {
        const m = res.data.match(/\d{6}/);
        if (m) {
          doneRef.current = true;
          stop();
          onDetected(m[0]);
          return;
        }
      }
    } catch {
      /* 解码异常忽略，继续下一帧 */
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [open]);

  useEffect(() => () => stop(), []);

  if (!open) {
    return (
      <>
        <button className="btn btn-ghost btn-sm" onClick={() => void start()} type="button">
          <IconScan width={14} height={14} />
          扫一扫
        </button>
        {err && <span className="count-hint warn">{err}</span>}
      </>
    );
  }

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted className="scanner-video" />
      <div className="scanner-frame" aria-hidden="true" />
      <div className="scanner-foot">
        <span className="count-hint">将发送端二维码对准取景框</span>
        <button className="btn btn-quiet btn-sm" onClick={stop} type="button">
          <IconX width={14} height={14} />
          关闭
        </button>
      </div>
    </div>
  );
}
