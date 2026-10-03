"use client";

import { useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCamera, IconMonitor, IconDownload, IconLoader, IconTrash } from "@/components/icons";

type TabId = "screen" | "camera";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "screen", label: "屏幕录制", icon: <IconMonitor width={15} height={15} /> },
  { id: "camera", label: "摄像头录制", icon: <IconCamera width={15} height={15} /> },
];

interface Rec {
  url: string;
  name: string;
  size: number;
  duration: string;
}

export default function RecorderPage() {
  const [tab, setTab] = useState<TabId>("screen");
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [err, setErr] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [starting, setStarting] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      stopStream();
      recs.forEach((r) => URL.revokeObjectURL(r.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      try {
        mediaRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  }

  const start = async () => {
    setErr("");
    setStarting(true);
    try {
      const constraints: MediaStreamConstraints =
        tab === "screen"
          ? {
              video: { displaySurface: "monitor" },
              audio: { echoCancellation: true, noiseSuppression: true },
            }
          : { video: { facingMode: "user", width: { ideal: 1280 } }, audio: { echoCancellation: true, noiseSuppression: true } };
      const stream = tab === "screen" ? await (navigator.mediaDevices as MediaDevices & { getDisplayMedia(c: MediaStreamConstraints): Promise<MediaStream> }).getDisplayMedia(constraints) : await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
        const durSec = (Date.now() - startTimeRef.current) / 1000;
        const mm = String(Math.floor(durSec / 60)).padStart(2, "0");
        const ss = String(Math.floor(durSec % 60)).padStart(2, "0");
        const name = `recording_${Date.now()}.webm`;
        setRecs((prev) => [...prev, { url: URL.createObjectURL(blob), name, size: blob.size, duration: `${mm}:${ss}` }]);
        stopStream();
        setState("idle");
        setElapsed(0);
      };
      mediaRef.current = rec;
      rec.start(1000);
      startTimeRef.current = Date.now();
      setElapsed(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      stopStream();
      setState("idle");
      setErr(
        `录制启动失败：${e instanceof Error ? e.message : String(e)}。屏幕录制需要在浏览器弹窗中选择要共享的窗口或屏幕；摄像头录制需要授权摄像头与麦克风权限。`
      );
    } finally {
      setStarting(false);
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    } else {
      stopStream();
      setState("idle");
      setElapsed(0);
    }
  };

  const switchTab = (id: TabId) => {
    if (state === "recording") stop();
    setTab(id);
    setErr("");
  };

  const playPreview = (url: string) => {
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.play().catch(() => undefined);
    }
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="屏幕 / 摄像头录制"
        lede="录制屏幕或摄像头画面，支持系统声音与麦克风 — 录制内容仅在浏览器本地，可随时下载"
        chip={
          <span>
            <IconCamera width={12} height={12} />
            本地录制
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
          <span className="label">{tab === "screen" ? "屏幕录制" : "摄像头录制"}</span>
          <span className="right subtle">
            {state === "recording" ? `录制中 ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}` : state === "done" ? "已停止" : "未开始"}
          </span>
        </div>
        <div className="panel-body">
          <div className="rc-tips">
            {tab === "screen" ? (
              <ul>
                <li>点击「开始录制」后，在浏览器弹窗中选择要共享的整个屏幕或某个窗口。</li>
                <li>支持录制系统声音与麦克风（需在弹窗中勾选）。</li>
                <li>Chrome / Edge 桌面版体验最佳；移动端浏览器对屏幕共享支持有限。</li>
              </ul>
            ) : (
              <ul>
                <li>点击「开始录制」后，浏览器会请求摄像头与麦克风权限。</li>
                <li>录制输出为 WebM 格式，可直接下载或二次处理。</li>
              </ul>
            )}
          </div>

          {err && <div className="vc-log-error">{err}</div>}

          <div className="vc-actions">
            {state !== "recording" ? (
              <button type="button" className="btn btn-primary" onClick={start} disabled={starting}>
                {starting ? <IconLoader width={14} height={14} /> : null}
                {starting ? "请求中…" : "开始录制"}
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={stop}>
                停止录制
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">播放预览</span>
        </div>
        <div className="panel-body">
          <video ref={videoRef} controls className="rc-player" />
          {recs.length === 0 && <div className="subtle">录制完成后选择下方录制文件即可在此预览。</div>}
        </div>
      </div>

      {recs.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="label">录制历史</span>
            <span className="right subtle">{recs.length} 条</span>
          </div>
          <div className="panel-body">
            <div className="vd-filelist">
              {recs.map((r, i) => (
                <div key={r.name + i} className="vd-file">
                  <div className="vd-file-info">
                    <span className="vd-file-name">{r.name}</span>
                    <span className="vd-file-meta">
                      {r.duration} · {(r.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="vc-token-row" style={{ gap: 6 }}>
                    <button type="button" className="btn" onClick={() => playPreview(r.url)}>
                      预览
                    </button>
                    <a className="btn btn-primary" href={r.url} download={r.name}>
                      <IconDownload width={14} height={14} />
                      下载
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>录制全程在浏览器本地进行，画面不会上传任何服务器。刷新或关闭页面后，录制历史将清空。
      </div>
    </div>
  );
}
