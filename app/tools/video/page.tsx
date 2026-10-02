"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconVideo, IconScissors, IconFilm, IconMusic, IconRepeat, IconFileStack, IconSliders, IconTrash, IconDownload, IconLoader, IconUpload } from "@/components/icons";

/* ffmpeg.wasm 0.11 通过 UMD 自托管加载（绕开打包器对 import.meta.resolve 的限制） */
interface FFmpegInstance {
  load: () => Promise<void>;
  setProgress: (cb: (p: { ratio?: number }) => void) => void;
  setLogger: (cb: (l: { message?: string }) => void) => void;
  run: (...args: string[]) => Promise<void>;
  FS: (method: "writeFile" | "readFile" | "unlink", ...args: unknown[]) => Promise<void> | string | Uint8Array;
  exit: () => void;
}

declare global {
  interface Window {
    FFmpeg?: {
      createFFmpeg: (opts: { log?: boolean; corePath?: string; mainName?: string }) => FFmpegInstance;
      fetchFile: (file: File | Blob | string) => Promise<Uint8Array>;
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`加载脚本失败：${src}`));
    document.head.appendChild(s);
  });
}

async function ensureLibs(): Promise<void> {
  if (!window.FFmpeg) await loadScript("/ffmpeg/lib/ffmpeg.min.js");
}

type TabId = "trim" | "gif" | "audio" | "convert" | "concat" | "compress";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "trim", label: "裁剪", icon: <IconScissors width={15} height={15} /> },
  { id: "gif", label: "转 GIF", icon: <IconFilm width={15} height={15} /> },
  { id: "audio", label: "提取音频", icon: <IconMusic width={15} height={15} /> },
  { id: "convert", label: "格式转换", icon: <IconRepeat width={15} height={15} /> },
  { id: "concat", label: "拼接", icon: <IconFileStack width={15} height={15} /> },
  { id: "compress", label: "压缩", icon: <IconSliders width={15} height={15} /> },
];

/* 各 Tab 的文件数要求 */
const FILE_RULES: Record<TabId, { min: number; max: number; hint: string }> = {
  trim: { min: 1, max: 1, hint: "上传 1 个视频" },
  gif: { min: 1, max: 1, hint: "上传 1 个视频" },
  audio: { min: 1, max: 1, hint: "上传 1 个视频" },
  convert: { min: 1, max: 1, hint: "上传 1 个视频" },
  concat: { min: 2, max: 10, hint: "上传 2 ~ 10 个视频，按顺序拼接" },
  compress: { min: 1, max: 1, hint: "上传 1 个视频" },
};

/* 秒 → HH:MM:SS */
function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* 用 HTML video 探测时长 */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

/* readFile 返回 FileData（string 或 Uint8Array），统一转成 Blob */
function dataToBlob(data: unknown, type: string): Blob {
  const part = (data instanceof Uint8Array ? data.buffer : data) as BlobPart;
  return new Blob([part], { type });
}

interface OutFile {
  name: string;
  url: string;
  size: number;
}

export default function VideoPage() {
  const [tab, setTab] = useState<TabId>("trim");
  const [files, setFiles] = useState<File[]>([]);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [dragging, setDragging] = useState(false);

  /* 引擎状态 */
  const ffRef = useRef<FFmpegInstance | null>(null);
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  /* 结果 */
  const [outputs, setOutputs] = useState<OutFile[]>([]);
  const [log, setLog] = useState("");

  /* 参数 */
  const [trimStart, setTrimStart] = useState("");
  const [trimDur, setTrimDur] = useState("");
  const [trimAccurate, setTrimAccurate] = useState(false);
  const [gifFps, setGifFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);
  const [gifStart, setGifStart] = useState("");
  const [gifDur, setGifDur] = useState("");
  const [audioFmt, setAudioFmt] = useState("mp3");
  const [convFmt, setConvFmt] = useState("mp4");
  const [crf, setCrf] = useState(28);
  const [scaleTo, setScaleTo] = useState("0");

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* 加载 ffmpeg 引擎（懒加载，首次处理时才下载核心） */
  const ensureEngine = useCallback(async () => {
    if (ffRef.current) return ffRef.current;
    setLoadingEngine(true);
    setLog("正在加载视频处理引擎（首次需要下载，之后浏览器缓存）…");
    try {
      await ensureLibs();
      const { createFFmpeg } = window.FFmpeg!;
      const corePath = new URL("/ffmpeg/ffmpeg-core.js", window.location.href).href;
      const ff = createFFmpeg({ log: true, corePath, mainName: "main" });
      ff.setLogger(({ message }) => {
        if (message) setLog((p) => (p ? p + "\n" : "") + message);
      });
      ff.setProgress(({ ratio }) => {
        if (typeof ratio === "number" && ratio >= 0 && ratio <= 1) setProgress(ratio);
      });
      await ff.load();
      ffRef.current = ff;
      setEngineReady(true);
      setLoadingEngine(false);
      setLog("引擎就绪。");
      return ff;
    } catch (e) {
      setLoadingEngine(false);
      setLog(`引擎加载失败：${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }, []);

  /* 添加文件 */
  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const rule = FILE_RULES[tab];
      const arr = Array.from(list).filter((f) => f.type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|m4v|gif)$/i.test(f.name));
      if (!arr.length) {
        setLog("请选择视频文件（mp4 / webm / mov / avi / mkv 等）。");
        return;
      }
      const next = [...files, ...arr].slice(0, rule.max);
      setFiles(next);
      const ds: Record<string, number | null> = {};
      for (const f of next) ds[f.name] = await probeDuration(f);
      setDurations((prev) => ({ ...prev, ...ds }));
    },
    [files, tab]
  );

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  /* 清理输出 URL */
  useEffect(() => {
    return () => {
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
    };
  }, [outputs]);

  /* 生成随机工作文件名 */
  const wname = (ext: string) => `in_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;

  /* 核心：执行一次任务 */
  const run = async () => {
    const rule = FILE_RULES[tab];
    if (files.length < rule.min) {
      setLog(rule.hint);
      return;
    }
    setBusy(true);
    setProgress(0);
    setOutputs((prev) => {
      prev.forEach((o) => URL.revokeObjectURL(o.url));
      return [];
    });
    setLog("");
    try {
      const ff = await ensureEngine();
      const outs: OutFile[] = [];

      if (tab === "trim") {
        const src = files[0];
        const inName = wname("mp4");
        const outName = `trim_${Date.now()}.mp4`;
        await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
        const start = trimStart || "0";
        const dur = trimDur || "999999";
        if (trimAccurate) {
          await ff.run("-i", inName, "-ss", start, "-t", dur, "-c:v", "h264", "-c:a", "aac", "-movflags", "+faststart", outName);
        } else {
          await ff.run("-ss", start, "-i", inName, "-t", dur, "-c", "copy", outName);
        }
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, "video/mp4")),
          size: (data as Uint8Array).length,
        });
        await ff.FS("unlink", inName);
        await ff.FS("unlink", outName);
      }

      if (tab === "gif") {
        const src = files[0];
        const inName = wname("mp4");
        const outName = `anim_${Date.now()}.gif`;
        await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
        const vf = `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos`;
        const args = ["-i", inName];
        if (gifStart) args.push("-ss", gifStart);
        if (gifDur) args.push("-t", gifDur);
        args.push("-vf", vf, outName);
        await ff.run(...args);
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, "image/gif")),
          size: (data as Uint8Array).length,
        });
        await ff.FS("unlink", inName);
        await ff.FS("unlink", outName);
      }

      if (tab === "audio") {
        const src = files[0];
        const inName = wname("mp4");
        const map: Record<string, { codec: string; ext: string; type: string }> = {
          mp3: { codec: "libmp3lame", ext: "mp3", type: "audio/mpeg" },
          m4a: { codec: "aac", ext: "m4a", type: "audio/mp4" },
          wav: { codec: "pcm_s16le", ext: "wav", type: "audio/wav" },
          ogg: { codec: "libvorbis", ext: "ogg", type: "audio/ogg" },
        };
        const cfg = map[audioFmt] || map.mp3;
        const outName = `audio_${Date.now()}.${cfg.ext}`;
        await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
        await ff.run("-i", inName, "-vn", "-acodec", cfg.codec, outName);
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, cfg.type)),
          size: (data as Uint8Array).length,
        });
        await ff.FS("unlink", inName);
        await ff.FS("unlink", outName);
      }

      if (tab === "convert") {
        const src = files[0];
        const inName = wname("mp4");
        const map: Record<string, { args: string[]; ext: string; type: string }> = {
          mp4: { args: ["-c:v", "h264", "-c:a", "aac", "-movflags", "+faststart"], ext: "mp4", type: "video/mp4" },
          webm: { args: ["-c:v", "vp9", "-c:a", "libopus"], ext: "webm", type: "video/webm" },
          avi: { args: ["-c:v", "mpeg4", "-c:a", "mp3"], ext: "avi", type: "video/x-msvideo" },
          mov: { args: ["-c:v", "h264", "-c:a", "aac"], ext: "mov", type: "video/quicktime" },
        };
        const cfg = map[convFmt] || map.mp4;
        const outName = `conv_${Date.now()}.${cfg.ext}`;
        await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
        await ff.run("-i", inName, ...cfg.args, outName);
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, cfg.type)),
          size: (data as Uint8Array).length,
        });
        await ff.FS("unlink", inName);
        await ff.FS("unlink", outName);
      }

      if (tab === "concat") {
        const outName = `concat_${Date.now()}.mp4`;
        const listName = `concat_${Date.now()}.txt`;
        const lines: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const ext = f.name.split(".").pop() || "mp4";
          const inName = wname(ext);
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(f));
          lines.push(`file '${inName}'`);
        }
        await ff.FS("writeFile", listName, new TextEncoder().encode(lines.join("\n")));
        await ff.run("-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", outName);
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, "video/mp4")),
          size: (data as Uint8Array).length,
        });
        for (let i = 0; i < files.length; i++) {
          await ff.FS("unlink", lines[i].slice(6, -1));
        }
        await ff.FS("unlink", listName);
        await ff.FS("unlink", outName);
      }

      if (tab === "compress") {
        const src = files[0];
        const inName = wname("mp4");
        const outName = `compressed_${Date.now()}.mp4`;
        await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
        const args = ["-i", inName];
        if (scaleTo !== "0") args.push("-vf", `scale=${scaleTo}:-2`);
        args.push("-crf", String(crf), "-preset", "medium", "-movflags", "+faststart", outName);
        await ff.run(...args);
        const data = ff.FS("readFile", outName);
        outs.push({
          name: outName,
          url: URL.createObjectURL(dataToBlob(data, "video/mp4")),
          size: (data as Uint8Array).length,
        });
        await ff.FS("unlink", inName);
        await ff.FS("unlink", outName);
      }

      setOutputs(outs);
      if (!outs.length) setLog("没有生成输出文件。");
    } catch (e) {
      setLog((p) => (p ? p + "\n" : "") + `处理失败：${e instanceof Error ? e.message : (e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : JSON.stringify(e))}`);
    } finally {
      setBusy(false);
      /* 0.11 ST core 的 parseArgs 每次 run 泄漏 wasm 内存（官方已知 bug），
         多次连续处理会耗尽内存导致 ffmpeg 静默退出。每次处理后重建实例。 */
      const old = ffRef.current;
      ffRef.current = null;
      setEngineReady(false);
      if (old) {
        try {
          old.exit();
        } catch {
          /* ignore */
        }
      }
    }
  };

  const rule = FILE_RULES[tab];

  return (
    <div className="fade-rise">
      <ToolHead
        title="视频处理"
        lede="裁剪 · 转 GIF · 提取音频 · 格式转换 · 拼接 · 压缩 — 全部本地处理，视频不上传"
        chip={
          <span>
            <IconVideo width={12} height={12} />
            本地处理 · 隐私安全
          </span>
        }
      />

      {/* Tab 栏 */}
      <div className="hp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setFiles([]);
              setDurations({});
              setOutputs((prev) => {
                prev.forEach((o) => URL.revokeObjectURL(o.url));
                return [];
              });
              setLog("");
            }}
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
          <span className="label">视频文件</span>
          <span className="right subtle">{rule.hint}</span>
        </div>
        <div className="panel-body">
          {/* 拖拽上传 */}
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
            <span>点击或拖拽视频到此处</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.gif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="vd-filelist">
              {files.map((f, i) => (
                <div key={f.name + i} className="vd-file">
                  <div className="vd-file-info">
                    <span className="vd-file-name">{f.name}</span>
                    <span className="vd-file-meta">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                      {durations[f.name] != null ? ` · ${fmtTime(durations[f.name] as number)}` : ""}
                    </span>
                  </div>
                  <button type="button" className="vc-icon-btn" onClick={() => removeFile(f.name)} title="移除">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ===== 各 Tab 参数 ===== */}
          {tab === "trim" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">开始时间（秒，可留空 = 从头）</label>
                <input className="input" placeholder="如 12 或 0:30" value={trimStart} onChange={(e) => setTrimStart(e.target.value)} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">时长（秒，可留空 = 到结尾）</label>
                <input className="input" placeholder="如 10" value={trimDur} onChange={(e) => setTrimDur(e.target.value)} disabled={busy} />
              </div>
              <div className="vd-field vd-field-wide">
                <label className="vc-checkbox-label">
                  <input type="checkbox" checked={trimAccurate} onChange={(e) => setTrimAccurate(e.target.checked)} disabled={busy} />
                  <span>精确裁剪（重新编码，慢；不勾选为快速裁剪，秒级完成但切点按关键帧对齐）</span>
                </label>
              </div>
            </div>
          )}

          {tab === "gif" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">帧率 fps</label>
                <input type="number" className="input" value={gifFps} min={1} max={30} onChange={(e) => setGifFps(Math.max(1, parseInt(e.target.value) || 10))} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">宽度 px（高度等比）</label>
                <input type="number" className="input" value={gifWidth} min={100} max={1920} onChange={(e) => setGifWidth(Math.max(100, parseInt(e.target.value) || 480))} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">开始时间（秒，可选）</label>
                <input className="input" placeholder="留空 = 从头" value={gifStart} onChange={(e) => setGifStart(e.target.value)} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">时长（秒，可选）</label>
                <input className="input" placeholder="留空 = 全部" value={gifDur} onChange={(e) => setGifDur(e.target.value)} disabled={busy} />
              </div>
            </div>
          )}

          {tab === "audio" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">输出格式</label>
                <div className="vd-segmented" role="radiogroup">
                  {["mp3", "m4a", "wav", "ogg"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      data-active={audioFmt === f}
                      onClick={() => setAudioFmt(f)}
                      className="vd-seg-btn"
                      disabled={busy}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "convert" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">目标格式</label>
                <div className="vd-segmented" role="radiogroup">
                  {["mp4", "webm", "avi", "mov"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      data-active={convFmt === f}
                      onClick={() => setConvFmt(f)}
                      className="vd-seg-btn"
                      disabled={busy}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "compress" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">压缩强度（CRF，越小越清晰）</label>
                <div className="vd-segmented" role="radiogroup">
                  {[
                    { v: 24, label: "画质优先" },
                    { v: 28, label: "平衡" },
                    { v: 32, label: "高压缩" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      data-active={crf === o.v}
                      onClick={() => setCrf(o.v)}
                      className="vd-seg-btn"
                      disabled={busy}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="vd-field">
                <label className="vc-label">输出分辨率</label>
                <div className="vd-segmented" role="radiogroup">
                  {[
                    { v: "0", label: "原始" },
                    { v: "1280", label: "720p" },
                    { v: "854", label: "480p" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      data-active={scaleTo === o.v}
                      onClick={() => setScaleTo(o.v)}
                      className="vd-seg-btn"
                      disabled={busy}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 操作行 */}
          <div className="vd-actions">
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy || files.length < rule.min}>
              {busy ? (
                <>
                  <IconLoader className="vd-spin" width={16} height={16} />
                  处理中…
                </>
              ) : loadingEngine ? (
                <>
                  <IconLoader className="vd-spin" width={16} height={16} />
                  加载引擎…
                </>
              ) : (
                <>
                  <IconVideo width={16} height={16} />
                  开始处理
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFiles([]);
                setDurations({});
                setOutputs((prev) => {
                  prev.forEach((o) => URL.revokeObjectURL(o.url));
                  return [];
                });
                setLog("");
              }}
              disabled={busy || (!files.length && !outputs.length)}
            >
              清空
            </button>
          </div>

          {/* 进度 */}
          {busy && (
            <div className="vd-progress">
              <div className="vd-progress-bar">
                <div className="vd-progress-fill" style={{ width: `${Math.max(2, progress * 100)}%` }} />
              </div>
              <span className="vd-progress-text">{progress > 0 ? `${Math.round(progress * 100)}%` : "处理中…"}</span>
            </div>
          )}

          {/* 日志 */}
          {log && <pre className="vd-log">{log}</pre>}

          {/* 结果 */}
          {outputs.length > 0 && (
            <div className="vd-outputs">
              {outputs.map((o) => (
                <div key={o.name} className="vd-output">
                  <span className="vd-output-name">
                    {o.name}（{(o.size / 1024 / 1024).toFixed(2)} MB）
                  </span>
                  <a className="btn btn-sm btn-primary" href={o.url} download={o.name}>
                    <IconDownload width={14} height={14} />
                    下载
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="vc-note">
        <strong>说明：</strong>视频在浏览器本地用 ffmpeg.wasm 处理，不上传任何服务器，关掉页面即彻底清除。
        大文件受浏览器内存限制，建议单文件 ≤ 500MB。
        {!engineReady && !loadingEngine && " 首次处理需下载约 24MB 引擎，之后浏览器会缓存。"}
      </div>
    </div>
  );
}
