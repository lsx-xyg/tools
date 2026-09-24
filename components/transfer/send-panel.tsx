"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createFileTransfer,
  createRtcRoom,
  createTextTransfer,
  deleteRtcRoom,
  deleteTransfer,
  offlineLink,
  rtcLink,
} from "@/lib/api";
import { startSender, type RtcPhase } from "@/lib/rtc-client";
import { copyText } from "@/lib/clipboard";
import { countChars, fmtBytes, LIMITS, validateFiles } from "@/lib/limits";
import { useCountdown } from "@/lib/use-countdown";
import { CodeDisplay } from "./code-display";
import {
  IconBolt,
  IconCheck,
  IconCopy,
  IconDocText,
  IconFile,
  IconLink,
  IconPaste,
  IconRefresh,
  IconServer,
  IconTrash,
  IconUpload,
  IconWifi,
  IconX,
} from "../icons";

type SendMode = "rtc" | "offline";
type ContentMode = "text" | "file";
type Phase = "idle" | "creating" | "waiting" | "connecting" | "transferring" | "done" | "error";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className={`btn ${ok ? "btn-ghost" : "btn-ghost"}`}
      onClick={async () => {
        const done = await copyText(text);
        if (done) {
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        }
      }}
    >
      {ok ? <IconCheck /> : <IconCopy />}
      {ok ? "已复制" : label}
    </button>
  );
}

function ReadyView({
  code,
  mode,
  expiresAt,
  onReset,
  onDelete,
  extra,
}: {
  code: string;
  mode: SendMode;
  expiresAt?: number;
  onReset(): void;
  onDelete?(): void;
  extra?: React.ReactNode;
}) {
  const link = mode === "rtc" ? rtcLink(code) : offlineLink(code);
  const cd = useCountdown(expiresAt ?? 0);
  return (
    <div className="rtc-sender-state fade-rise">
      <span className="label">{mode === "rtc" ? "连接提取码" : "提取码"}</span>
      <CodeDisplay code={code} accent />
      <div className="qr-wrap">
        <QRCodeSVG value={link} size={148} level="M" marginSize={0} />
      </div>
      <div className="state-line">
        <IconLink width={14} height={14} />
        <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>
          {link.replace(/^https?:\/\//, "")}
        </span>
      </div>
      <div className="result-actions" style={{ justifyContent: "center" }}>
        <CopyButton text={code} label="复制提取码" />
        <CopyButton text={link} label="复制链接" />
      </div>
      {extra}
      <div className="result-actions" style={{ justifyContent: "center" }}>
        <button className="btn btn-quiet btn-sm" onClick={onReset}>
          <IconRefresh width={14} height={14} />
          再发一份
        </button>
        {onDelete && (
          <button className="btn btn-quiet btn-sm" onClick={onDelete}>
            <IconTrash width={14} height={14} />
            立即删除
          </button>
        )}
      </div>
      {mode === "offline" && cd && (
        <div className="state-line">
          <IconServer width={14} height={14} />
          <span className="mono" style={{ fontSize: 12 }}>
            24h 自动清除 · 剩余 {cd}
          </span>
        </div>
      )}
      {mode === "rtc" && (
        <div className="state-line">
          <IconWifi width={14} height={14} />
          <span className="mono" style={{ fontSize: 12 }}>
            在线直传 · 文件不经服务器
          </span>
        </div>
      )}
    </div>
  );
}

function StatusLine({ lamp, children }: { lamp: "ok" | "amber" | "err"; children: React.ReactNode }) {
  return (
    <div className="state-line" role="status">
      <span className={`lamp ${lamp}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function SendPanel() {
  const [sendMode, setSendMode] = useState<SendMode>("rtc");
  const [contentMode, setContentMode] = useState<ContentMode>("text");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const senderRef = useRef<{ cancel(): void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chars = countChars(text);
  const textOver = chars > LIMITS.textMaxChars;
  const totalSize = files.reduce((a, f) => a + f.size, 0);

  useEffect(() => {
    return () => {
      senderRef.current?.cancel();
    };
  }, []);

  const reset = useCallback(() => {
    senderRef.current?.cancel();
    senderRef.current = null;
    setPhase("idle");
    setCode("");
    setError("");
    setProgress(null);
    if (sendMode === "offline" && contentMode === "file") setFiles([]);
    if (sendMode === "offline" && contentMode === "text") setText("");
  }, [sendMode, contentMode]);

  const onRtcPhase = useCallback((p: RtcPhase, detail?: string) => {
    if (p === "waiting") setPhase("waiting");
    else if (p === "connecting") setPhase("connecting");
    else if (p === "transferring") setPhase("transferring");
    else if (p === "done") setPhase("done");
    else if (p === "error") {
      setPhase("error");
      setError(detail || "传输失败，请重试");
    }
  }, []);

  async function handleSend() {
    if (phase === "creating" || phase === "waiting" || phase === "transferring") return;
    setError("");

    if (sendMode === "rtc") {
      if (contentMode === "text") {
        const t = text.trim();
        if (!t) return setError("请输入要发送的文本");
        if (textOver) return setError(`文本超过 ${LIMITS.textMaxChars.toLocaleString()} 字符上限`);
      } else {
        const e = validateFiles(files);
        if (e) return setError(e);
      }
      setPhase("creating");
      try {
        const { code: c } = await createRtcRoom();
        setCode(c);
        setPhase("waiting");
        senderRef.current = startSender(
          c,
          contentMode === "text" ? { text } : { files },
          {
            onPhase: onRtcPhase,
            onProgress: (sent, total) => setProgress({ sent, total }),
          },
        );
      } catch {
        setPhase("error");
        setError("创建传输失败，请重试");
      }
      return;
    }

    // 离线模式
    setPhase("creating");
    try {
      const meta =
        contentMode === "text"
          ? await createTextTransfer(text)
          : await createFileTransfer(files);
      setCode(meta.code);
      setExpiresAt(meta.expiresAt);
      setPhase("waiting");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "创建失败，请重试");
    }
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    setFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= LIMITS.filesMaxCount) break;
        if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
      }
      return next;
    });
  }

  function switchContent(mode: ContentMode) {
    setContentMode(mode);
    if (phase !== "idle") {
      senderRef.current?.cancel();
      senderRef.current = null;
      setPhase("idle");
      setCode("");
      setError("");
    }
  }

  async function handleDelete() {
    if (!code) return;
    try {
      if (sendMode === "offline") await deleteTransfer(code);
      else await deleteRtcRoom(code);
    } catch {
      /* ignore */
    }
    reset();
  }

  const busy = phase === "creating" || phase === "connecting" || phase === "transferring";

  return (
    <section className="panel" aria-labelledby="send-title">
      <div className="panel-head">
        <span className="label" id="send-title">
          <span className={`lamp ${phase === "done" ? "ok" : phase === "error" ? "err" : "amber"}`} aria-hidden="true" />
          发送
        </span>
        <span className="right label">T-01 · TX</span>
      </div>
      <div className="panel-body">
        <div className="input-row" style={{ flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label="传输模式">
            <button className={sendMode === "rtc" ? "active" : ""} onClick={() => setSendMode("rtc")} disabled={busy}>
              <IconBolt width={14} height={14} />
              在线直传
            </button>
            <button className={sendMode === "offline" ? "active" : ""} onClick={() => setSendMode("offline")} disabled={busy}>
              <IconServer width={14} height={14} />
              离线 24h
            </button>
          </div>
          <div className="seg" role="group" aria-label="内容类型">
            <button className={contentMode === "text" ? "active" : ""} onClick={() => switchContent("text")} disabled={busy}>
              <IconDocText width={14} height={14} />
              文本
            </button>
            <button className={contentMode === "file" ? "active" : ""} onClick={() => switchContent("file")} disabled={busy}>
              <IconFile width={14} height={14} />
              文件
            </button>
          </div>
        </div>

        {phase === "idle" || phase === "creating" ? (
          <>
            {contentMode === "text" ? (
              <div className="field">
                <label className="field-label" htmlFor="send-text">
                  文本内容
                </label>
                <textarea
                  id="send-text"
                  className="textarea"
                  placeholder="输入要发送的文本：密码、地址、长文、代码片段…（发送端与接收端内容完全一致）"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={phase === "creating"}
                />
                <div className="input-row" style={{ justifyContent: "space-between" }}>
                  <span className={`count-hint ${textOver ? "warn" : ""}`}>
                    {chars.toLocaleString()} / {LIMITS.textMaxChars.toLocaleString()}
                  </span>
                  <span className="input-row">
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={async () => {
                        try {
                          const t = await navigator.clipboard.readText();
                          if (t) setText(t);
                        } catch {
                          setError("无法读取剪贴板，请手动粘贴");
                        }
                      }}
                    >
                      <IconPaste width={14} height={14} />
                      粘贴
                    </button>
                    <button className="btn btn-quiet btn-sm" onClick={() => setText("")} disabled={!text}>
                      <IconX width={14} height={14} />
                      清空
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <div className="field">
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div
                  className={`dropzone ${drag ? "drag" : ""}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                  }}
                  aria-label="选择或拖拽文件"
                >
                  <IconUpload />
                  <span className="dz-main">点击选择或拖拽文件到这里</span>
                  <span className="dz-sub">最多 {LIMITS.filesMaxCount} 个 · 单个 ≤ 10 MB · 总量 ≤ 50 MB</span>
                </div>
                {files.length > 0 && (
                  <div className="file-list">
                    {files.map((f, i) => (
                      <div className="file-row" key={`${f.name}-${f.size}-${i}`}>
                        <IconFile className="file-type" />
                        <span className="f-name" title={f.name}>
                          {f.name}
                        </span>
                        <span className="f-size">{fmtBytes(f.size)}</span>
                        <button
                          className="icon-btn"
                          onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`移除 ${f.name}`}
                        >
                          <IconX />
                        </button>
                      </div>
                    ))}
                    <div className="count-hint" style={{ textAlign: "right" }}>
                      共 {files.length} 个 · {fmtBytes(totalSize)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="alert err" role="alert">
                <IconX />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-block" onClick={handleSend} disabled={busy}>
              {phase === "creating" ? (
                <>
                  <span className="spinner" />
                  {sendMode === "rtc" ? "正在建立连接…" : "正在上传…"}
                </>
              ) : sendMode === "rtc" ? (
                <>
                  <IconBolt />
                  生成连接码
                </>
              ) : (
                <>
                  <IconServer />
                  生成提取码
                </>
              )}
            </button>
          </>
        ) : phase === "waiting" || phase === "connecting" || phase === "transferring" ? (
          <>
            {sendMode === "rtc" ? (
              <ReadyView
                code={code}
                mode="rtc"
                onReset={reset}
                onDelete={handleDelete}
                extra={
                  phase === "waiting" ? (
                    <StatusLine lamp="amber">
                      等待对方输入提取码或扫码…（对方打开链接后自动连接）
                    </StatusLine>
                  ) : phase === "connecting" ? (
                    <StatusLine lamp="amber">
                      <span className="spinner" />
                      正在建立点对点连接…
                    </StatusLine>
                  ) : phase === "transferring" ? (
                    <div className="progress-wrap">
                      <div className="progress-meta">
                        <span>正在直传…</span>
                        {progress && (
                          <span>
                            {fmtBytes(progress.sent)} / {fmtBytes(progress.total)}
                          </span>
                        )}
                      </div>
                      <div className="progress-bar">
                        <i
                          style={{
                            width: progress ? `${Math.min(100, (progress.sent / Math.max(1, progress.total)) * 100)}%` : "4%",
                          }}
                        />
                      </div>
                    </div>
                  ) : null
                }
              />
            ) : (
              <ReadyView
                code={code}
                mode="offline"
                expiresAt={expiresAt}
                onReset={reset}
                onDelete={handleDelete}
              />
            )}
          </>
        ) : phase === "done" ? (
          <div className="rtc-sender-state fade-rise">
            <StatusLine lamp="ok">
              <IconCheck width={16} height={16} />
              {sendMode === "rtc" ? "内容已直传到对方设备" : "传输完成"}
            </StatusLine>
            <p className="lede" style={{ fontSize: 13.5, textAlign: "center" }}>
              {sendMode === "rtc"
                ? "文件仅在两台设备间传递，服务器上没有任何内容。"
                : "内容将保留 24 小时，到期自动清除。"}
            </p>
            <button className="btn btn-primary" onClick={reset}>
              <IconRefresh width={16} height={16} />
              再发一份
            </button>
          </div>
        ) : (
          <div className="rtc-sender-state">
            <div className="alert err" role="alert">
              <IconX />
              <span>{error || "出错了，请重试"}</span>
            </div>
            <button className="btn btn-ghost" onClick={reset}>
              返回
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
