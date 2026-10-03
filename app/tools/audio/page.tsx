"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { useFFmpeg, dataToBlob } from "@/lib/use-ffmpeg";
import { IconAudioWave, IconConcat, IconScissors, IconRepeat, IconGauge, IconTrash, IconDownload, IconLoader, IconUpload } from "@/components/icons";

type TabId = "convert" | "concat" | "trim" | "tempo";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "convert", label: "格式转换", icon: <IconRepeat width={15} height={15} /> },
  { id: "concat", label: "拼接", icon: <IconConcat width={15} height={15} /> },
  { id: "trim", label: "裁剪", icon: <IconScissors width={15} height={15} /> },
  { id: "tempo", label: "变速变调", icon: <IconGauge width={15} height={15} /> },
];

const FILE_RULES: Record<TabId, { min: number; max: number; hint: string }> = {
  convert: { min: 1, max: 1, hint: "上传 1 个音频" },
  concat: { min: 2, max: 10, hint: "上传 2 ~ 10 个音频，按顺序拼接" },
  trim: { min: 1, max: 1, hint: "上传 1 个音频" },
  tempo: { min: 1, max: 1, hint: "上传 1 个音频" },
};

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? a.duration : null);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    a.src = url;
  });
}

interface OutFile {
  name: string;
  url: string;
  size: number;
}

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac|opus|webm|wma|m4b)$/i;

export default function AudioPage() {
  const [tab, setTab] = useState<TabId>("convert");
  const [files, setFiles] = useState<File[]>([]);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [dragging, setDragging] = useState(false);
  const [outputs, setOutputs] = useState<OutFile[]>([]);

  const { runTask, wname, busy, progress, engineReady, loadingEngine, log } = useFFmpeg();

  /* 参数 */
  const [fmt, setFmt] = useState("mp3");
  const [trimStart, setTrimStart] = useState("");
  const [trimDur, setTrimDur] = useState("");
  const [tempo, setTempo] = useState(1.25);
  const [pitch, setPitch] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const rule = FILE_RULES[tab];
      const arr = Array.from(list).filter((f) => f.type.startsWith("audio/") || AUDIO_EXT.test(f.name));
      if (!arr.length) {
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

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  useEffect(() => {
    return () => {
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
    };
  }, [outputs]);

  const clearOutputs = () => {
    setOutputs((prev) => {
      prev.forEach((o) => URL.revokeObjectURL(o.url));
      return [];
    });
  };

  const run = async () => {
    const rule = FILE_RULES[tab];
    if (files.length < rule.min) return;
    clearOutputs();
    try {
      await runTask(async (ff) => {
        const outs: OutFile[] = [];

        if (tab === "convert") {
          const src = files[0];
          const ext = (src.name.split(".").pop() || "audio").toLowerCase();
          const inName = wname(ext);
          const map: Record<string, { codec: string; ext: string; type: string }> = {
            mp3: { codec: "libmp3lame", ext: "mp3", type: "audio/mpeg" },
            wav: { codec: "pcm_s16le", ext: "wav", type: "audio/wav" },
            m4a: { codec: "aac", ext: "m4a", type: "audio/mp4" },
            ogg: { codec: "libvorbis", ext: "ogg", type: "audio/ogg" },
            flac: { codec: "flac", ext: "flac", type: "audio/flac" },
            opus: { codec: "libopus", ext: "opus", type: "audio/opus" },
          };
          const cfg = map[fmt] || map.mp3;
          const outName = `audio_${Date.now()}.${cfg.ext}`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
          await ff.run("-i", inName, "-vn", "-acodec", cfg.codec, outName);
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, cfg.type)), size: (data as Uint8Array).length });
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        }

        if (tab === "concat") {
          const outName = `concat_${Date.now()}.mp3`;
          const listName = `concat_${Date.now()}.txt`;
          const lines: string[] = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const ext = (f.name.split(".").pop() || "mp3").toLowerCase();
            const inName = wname(ext);
            await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(f));
            lines.push(`file '${inName}'`);
          }
          await ff.FS("writeFile", listName, new TextEncoder().encode(lines.join("\n")));
          await ff.run("-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", outName);
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, "audio/mpeg")), size: (data as Uint8Array).length });
          for (let i = 0; i < files.length; i++) {
            await ff.FS("unlink", lines[i].slice(6, -1));
          }
          await ff.FS("unlink", listName);
          await ff.FS("unlink", outName);
        }

        if (tab === "trim") {
          const src = files[0];
          const ext = (src.name.split(".").pop() || "mp3").toLowerCase();
          const inName = wname(ext);
          const outName = `trim_${Date.now()}.mp3`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
          const args = ["-i", inName];
          if (trimStart) args.push("-ss", trimStart);
          if (trimDur) args.push("-t", trimDur);
          args.push("-c", "copy", outName);
          await ff.run(...args);
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, "audio/mpeg")), size: (data as Uint8Array).length });
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        }

        if (tab === "tempo") {
          const src = files[0];
          const ext = (src.name.split(".").pop() || "mp3").toLowerCase();
          const inName = wname(ext);
          const outName = `tempo_${Date.now()}.mp3`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
          /* atempo 仅支持 0.5 ~ 2.0，超出区间需级联多个 atempo */
          const rate = Math.min(4, Math.max(0.25, tempo));
          const filters: string[] = [];
          let r = rate;
          while (r > 2) {
            filters.push("atempo=2.0");
            r /= 2;
          }
          while (r < 0.5) {
            filters.push("atempo=0.5");
            r /= 0.5;
          }
          filters.push(`atempo=${r.toFixed(3)}`);
          const af = filters.join(",");
          const args = ["-i", inName];
          if (pitch !== 0) {
            /* 变速 + 变调：先 asetrate 改采样率，再 atempo 补回时长 → 音调变化而速度不变 */
            const semis = Math.max(-12, Math.min(12, pitch));
            const factor = Math.pow(2, semis / 12);
            const sr = Math.round(44100 * factor);
            await ff.run("-i", inName, "-af", `${af},asetrate=${sr},aresample=44100`, "-c:a", "libmp3lame", outName);
          } else {
            await ff.run("-i", inName, "-af", af, "-c:a", "libmp3lame", outName);
          }
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, "audio/mpeg")), size: (data as Uint8Array).length });
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        }

        setOutputs(outs);
      });
    } catch {
      /* 错误已由 hook 记录 */
    }
  };

  const rule = FILE_RULES[tab];

  return (
    <div className="fade-rise">
      <ToolHead
        title="音频处理"
        lede="格式转换 · 拼接 · 裁剪 · 变速变调 — 全部本地处理，音频不上传"
        chip={
          <span>
            <IconAudioWave width={12} height={12} />
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
            onClick={() => {
              setTab(t.id);
              setFiles([]);
              setDurations({});
              clearOutputs();
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
          <span className="label">音频文件</span>
          <span className="right subtle">{rule.hint}</span>
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
            <span>点击或拖拽音频到此处</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.wma"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

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

          {tab === "convert" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">输出格式</label>
                <select className="input" value={fmt} onChange={(e) => setFmt(e.target.value)} disabled={busy}>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                  <option value="m4a">M4A</option>
                  <option value="ogg">OGG</option>
                  <option value="flac">FLAC</option>
                  <option value="opus">OPUS</option>
                </select>
              </div>
            </div>
          )}

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
            </div>
          )}

          {tab === "tempo" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">速度倍率（0.25 ~ 4.0，&gt;1 加速）</label>
                <input type="number" step="0.05" className="input" value={tempo} onChange={(e) => setTempo(parseFloat(e.target.value) || 1)} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">音调（半音，-12 ~ 12，0 = 不变调）</label>
                <input type="number" step="1" className="input" value={pitch} onChange={(e) => setPitch(Math.max(-12, Math.min(12, parseInt(e.target.value) || 0)))} disabled={busy} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy || files.length < rule.min}>
          {busy ? <IconLoader width={14} height={14} /> : null}
          {busy ? "处理中…" : "开始处理"}
        </button>
        <button type="button" className="btn" onClick={() => { setFiles([]); setDurations({}); clearOutputs(); }} disabled={busy}>
          清空
        </button>
      </div>

      {(busy || loadingEngine) && (
        <div className="vd-progress">
          <div className="vd-progress-bar">
            <div className="vd-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="vd-progress-text">{Math.round(progress * 100)}%</div>
        </div>
      )}

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

      {log && (
        <div className="vd-log">
          <pre>{log}</pre>
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>音频在浏览器本地用 ffmpeg.wasm 处理，不上传任何服务器，关掉页面即彻底清除。
        大文件受浏览器内存限制，建议单文件 ≤ 500MB。
        {!engineReady && !loadingEngine && " 首次处理需下载约 24MB 引擎，之后浏览器会缓存。"}
      </div>
    </div>
  );
}
