"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  fetchTransfer,
  getRtcRoom,
  offlineFileUrl,
  type OfflineTransferDetail,
} from "@/lib/api";
import { startReceiver, type RtcPhase, type ReceivedFile } from "@/lib/rtc-client";
import { copyText } from "@/lib/clipboard";
import { countChars, fmtBytes } from "@/lib/limits";
import { useCountdown } from "@/lib/use-countdown";
import {
  IconCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconFile,
  IconRefresh,
  IconSearch,
  IconWifi,
  IconX,
} from "../icons";

type Phase = "idle" | "probing" | "connecting" | "transferring" | "done" | "error";

function parseInput(v: string): { code: string } | null {
  const m = v.trim().match(/\d{6}/);
  if (!m) return null;
  return { code: m[0] };
}

function DownloadItem({ f }: { f: ReceivedFile }) {
  const [got, setGot] = useState(false);
  return (
    <div className="file-row">
      <IconFile className="file-type" />
      <span className="f-name" title={f.name}>
        {f.name}
      </span>
      <span className="f-size">{fmtBytes(f.size)}</span>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => {
          const url = URL.createObjectURL(f.blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          setGot(true);
        }}
      >
        {got ? <IconCheck width={14} height={14} /> : <IconDownload width={14} height={14} />}
        {got ? "已下载" : "下载"}
      </button>
    </div>
  );
}

export function ReceivePanel({ autoJoin }: { autoJoin?: { mode?: string; code?: string } }) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<OfflineTransferDetail | null>(null);
  const [rtcText, setRtcText] = useState<string | null>(null);
  const [rtcFiles, setRtcFiles] = useState<ReceivedFile[]>([]);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const receiverRef = useRef<{ cancel(): void } | null>(null);
  const joinedRef = useRef(false);

  const reset = useCallback(() => {
    receiverRef.current?.cancel();
    receiverRef.current = null;
    joinedRef.current = false;
    setPhase("idle");
    setError("");
    setDetail(null);
    setRtcText(null);
    setRtcFiles([]);
    setProgress(null);
    setInput("");
  }, []);

  const hooks = useMemo(
    () => ({
      onPhase(p: RtcPhase, d?: string) {
        if (p === "looking") setPhase("probing");
        else if (p === "connecting") setPhase("connecting");
        else if (p === "transferring") setPhase("transferring");
        else if (p === "done") setPhase("done");
        else if (p === "error") {
          setPhase("error");
          setError(d || "连接失败，请重试");
        }
      },
      onText(t: string) {
        setRtcText(t);
      },
      onFiles(f: ReceivedFile[]) {
        setRtcFiles(f);
      },
      onProgress(sent: number, total: number) {
        setProgress({ sent, total });
      },
    }),
    [],
  );

  useEffect(() => {
    return () => {
      receiverRef.current?.cancel();
    };
  }, []);

  const join = useCallback(
    async (raw: string) => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      const parsed = parseInput(raw);
      if (!parsed) {
        setError("请输入 6 位提取码，或粘贴发送端分享的链接");
        setPhase("idle");
        joinedRef.current = false;
        return;
      }
      setError("");
      setPhase("probing");

      // 先探测是否为在线 P2P 房间
      let isRtc = false;
      try {
        const room = await getRtcRoom(parsed.code);
        if (room) isRtc = true;
      } catch {
        /* fall through to offline */
      }

      if (isRtc) {
        setPhase("connecting");
        receiverRef.current = startReceiver(parsed.code, hooks);
        return;
      }

      // 离线传输
      try {
        const d = await fetchTransfer(parsed.code);
        setDetail(d);
        setPhase("done");
      } catch (e) {
        setPhase("error");
        setError(
          e instanceof ApiError
            ? e.status === 404
              ? "提取码不存在，请检查是否输入正确"
              : e.status === 410
                ? "内容已过期或已被发送方删除"
                : e.status === 429
                  ? "下载次数已用完"
                  : e.message
            : "网络异常，请重试",
        );
      }
    },
    [hooks],
  );

  // 从二维码 / 分享链接自动加入
  useEffect(() => {
    if (autoJoin?.code && autoJoin.code.length === 6 && !joinedRef.current) {
      setInput(autoJoin.code);
      void join(autoJoin.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin?.code]);

  const cd = useCountdown(detail?.expiresAt ?? 0);

  return (
    <section className="panel" aria-labelledby="recv-title">
      <div className="panel-head">
        <span className="label" id="recv-title">
          <span className={`lamp ${phase === "done" ? "ok" : phase === "error" ? "err" : "amber"}`} aria-hidden="true" />
          接收
        </span>
        <span className="right label">T-01 · RX</span>
      </div>
      <div className="panel-body">
        <div
          className="panel-swap"
          key={`rx-${phase}-${detail?.code ?? "none"}-${rtcFiles.length}`}
        >
        {phase === "idle" || phase === "probing" ? (
          <>
            <div className="field">
              <label className="field-label" htmlFor="recv-code">
                提取码或链接
              </label>
              <input
                id="recv-code"
                className="input code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={input}
                disabled={phase === "probing"}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setInput(digits);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.length === 6) void join(input);
                }}
                aria-describedby="recv-hint"
              />
              <span className="count-hint" id="recv-hint">
                输入发送端显示的提取码，或粘贴带提取码的链接（支持扫码进入）
              </span>
            </div>

            {error && (
              <div className="alert err" role="alert">
                <IconX />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-block"
              disabled={input.length !== 6 || phase === "probing"}
              onClick={() => void join(input)}
            >
              {phase === "probing" ? (
                <>
                  <span className="spinner" />
                  正在查找…
                </>
              ) : (
                <>
                  <IconSearch />
                  取回内容
                </>
              )}
            </button>
          </>
        ) : phase === "connecting" || phase === "transferring" ? (
          <div className="rtc-sender-state">
            <StatusLine lamp="amber">
              <IconWifi width={16} height={16} />
              {phase === "connecting" ? "正在与发送方建立点对点连接…" : "正在接收内容…"}
            </StatusLine>
            {phase === "transferring" && (
              <div className="progress-wrap">
                <div className="progress-meta">
                  <span>接收进度</span>
                  {progress && (
                    <span>
                      {fmtBytes(progress.sent)} / {fmtBytes(progress.total)}
                    </span>
                  )}
                </div>
                <div className="progress-bar">
                  <i
                    style={{
                      width: progress ? `${Math.min(100, (progress.sent / Math.max(1, progress.total)) * 100)}%` : "6%",
                    }}
                  />
                </div>
              </div>
            )}
            <button className="btn btn-quiet btn-sm" onClick={reset}>
              取消
            </button>
          </div>
        ) : phase === "done" ? (
          <div className="rtc-sender-state fade-rise">
            {rtcText !== null ? (
              <>
                <StatusLine lamp="ok">
                  <IconCheck width={16} height={16} />
                  已接收文本（{countChars(rtcText).toLocaleString()} 字符）
                </StatusLine>
                <div className="result-box">{rtcText}</div>
                <div className="result-actions" style={{ justifyContent: "center" }}>
                  <CopyButton text={rtcText} label="复制全文" />
                </div>
              </>
            ) : rtcFiles.length > 0 ? (
              <>
                <StatusLine lamp="ok">
                  <IconCheck width={16} height={16} />
                  已接收 {rtcFiles.length} 个文件，仅存在于本设备
                </StatusLine>
                <div className="file-list" style={{ width: "100%" }}>
                  {rtcFiles.map((f, i) => (
                    <DownloadItem key={`${f.name}-${i}`} f={f} />
                  ))}
                </div>
              </>
            ) : detail ? (
              <>
                {detail.kind === "text" && detail.text !== undefined ? (
                  <>
                    <StatusLine lamp="ok">
                      <IconCheck width={16} height={16} />
                      已取回文本（{countChars(detail.text).toLocaleString()} 字符）
                    </StatusLine>
                    <div className="result-box">{detail.text}</div>
                    <div className="result-actions" style={{ justifyContent: "center" }}>
                      <CopyButton text={detail.text} label="复制全文" />
                    </div>
                  </>
                ) : (
                  <>
                    <StatusLine lamp="ok">
                      <IconCheck width={16} height={16} />
                      已取回 {detail.files?.length ?? 0} 个文件 · 剩余下载{" "}
                      {detail.downloadsLeft ?? 0} 次
                    </StatusLine>
                    {cd !== null && (
                      <div className="state-line">
                        <IconClock width={14} height={14} />
                        <span className="mono" style={{ fontSize: 12 }}>
                          过期倒计时 {cd}
                        </span>
                      </div>
                    )}
                    <div className="file-list" style={{ width: "100%" }}>
                      {detail.files?.map((f) => (
                        <div className="file-row" key={f.index}>
                          <IconFile className="file-type" />
                          <span className="f-name" title={f.name}>
                            {f.name}
                          </span>
                          <span className="f-size">{fmtBytes(f.size)}</span>
                          <a
                            className="btn btn-sm btn-ghost"
                            href={offlineFileUrl(detail.code, f.index)}
                            download={f.name}
                          >
                            <IconDownload width={14} height={14} />
                            下载
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : null}
            <button className="btn btn-quiet btn-sm" onClick={reset}>
              <IconRefresh width={14} height={14} />
              再接收一份
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
      </div>
    </section>
  );
}

function StatusLine({ lamp, children }: { lamp: "ok" | "amber" | "err"; children: React.ReactNode }) {
  return (
    <div className="state-line" role="status">
      <span className={`lamp ${lamp}`} aria-hidden="true" />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{children}</span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn btn-ghost"
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
