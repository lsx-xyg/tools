"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { useFFmpeg, dataToBlob } from "@/lib/use-ffmpeg";
import { IconImage, IconFilm, IconGauge, IconRepeat, IconTrash, IconDownload, IconLoader, IconUpload } from "@/components/icons";

type TabId = "frame" | "gif2video" | "speed";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "frame", label: "视频抽帧", icon: <IconImage width={15} height={15} /> },
  { id: "gif2video", label: "GIF 转视频", icon: <IconFilm width={15} height={15} /> },
  { id: "speed", label: "倍速转换", icon: <IconGauge width={15} height={15} /> },
];

const FILE_RULES: Record<TabId, { min: number; max: number; hint: string }> = {
  frame: { min: 1, max: 1, hint: "上传 1 个视频" },
  gif2video: { min: 1, max: 1, hint: "上传 1 个 GIF" },
  speed: { min: 1, max: 1, hint: "上传 1 个视频" },
};

interface OutFile {
  name: string;
  url: string;
  size: number;
}

const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv|m4v|gif)$/i;

export default function VideoFramesPage() {
  const [tab, setTab] = useState<TabId>("frame");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [outputs, setOutputs] = useState<OutFile[]>([]);

  const { runTask, runBatch, wname, busy, progress, engineReady, loadingEngine, log } = useFFmpeg();

  /* 参数 */
  const [frameTimes, setFrameTimes] = useState("");
  const [frameInterval, setFrameInterval] = useState(1);
  const [speedRate, setSpeedRate] = useState(2);
  const [gifFmt, setGifFmt] = useState("mp4");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) => f.type.startsWith("video/") || VIDEO_EXT.test(f.name));
      if (!arr.length) return;
      const max = FILE_RULES[tab].max;
      setFiles((prev) => [...prev, ...arr].slice(0, max));
    },
    [tab]
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

        if (tab === "frame") {
          const src = files[0];
          const ext = (src.name.split(".").pop() || "mp4").toLowerCase();
          /* 0.11 ST core 的 parseArgs 每次 run 泄漏 wasm 内存（官方已知 bug），
             抽帧多个时间点必须逐次重建实例 */
          if (frameTimes.trim()) {
            const times = frameTimes.split(",").map((t) => t.trim()).filter(Boolean);
            const tasks = times.map((timePoint) => async (ff2: Parameters<Parameters<typeof runTask>[0]>[0]) => {
              const inName = wname(ext);
              const outName = `frame_${times.indexOf(timePoint) + 1}_${Date.now()}.png`;
              await ff2.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
              await ff2.run("-ss", timePoint, "-i", inName, "-frames:v", "1", outName);
              const data = ff2.FS("readFile", outName);
              outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, "image/png")), size: (data as Uint8Array).length });
              await ff2.FS("unlink", inName);
              await ff2.FS("unlink", outName);
            });
            await runBatch(tasks);
          } else {
            const iv = Math.max(0.1, frameInterval);
            const inName = wname(ext);
            /* 多帧输出必须使用 %d 序号模式，否则 ffmpeg 会因无法推断序号而报错只写 1 帧 */
            const base = `frames_${Date.now()}`;
            const outName = `${base}-%d.png`;
            await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
            try {
              await ff.run("-i", inName, "-vf", `fps=1/${iv}`, outName);
            } catch {
              /* 0.11 在部分滤镜下会抛错，但帧文件已写入 FS */
            }
            /* 多帧输出：ffmpeg 生成 frames_N-1.png, frames_N-2.png... */
            let i = 1;
            for (;;) {
              const candidate = `${base}-${i}.png`;
              try {
                const data = ff.FS("readFile", candidate) as Uint8Array;
                outs.push({ name: candidate, url: URL.createObjectURL(dataToBlob(data, "image/png")), size: data.length });
                await ff.FS("unlink", candidate);
                i++;
              } catch {
                break;
              }
            }
            /* 兜底：如果只有一帧输出（无序号） */
            if (outs.length === 0) {
              try {
                const data = ff.FS("readFile", `${base}.png`) as Uint8Array;
                outs.push({ name: `${base}.png`, url: URL.createObjectURL(dataToBlob(data, "image/png")), size: data.length });
                await ff.FS("unlink", `${base}.png`);
              } catch {
                /* 无帧 */
              }
            }
            await ff.FS("unlink", inName);
            if (!outs.length) throw new Error("未抽到任何帧，请检查视频或时间参数。");
          }
        }

        if (tab === "gif2video") {
          const src = files[0];
          const inName = wname("gif");
          const map: Record<string, { args: string[]; ext: string; type: string }> = {
            mp4: { args: ["-c:v", "h264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"], ext: "mp4", type: "video/mp4" },
            webm: { args: ["-c:v", "vp9", "-c:a", "libopus"], ext: "webm", type: "video/webm" },
            mov: { args: ["-c:v", "h264", "-pix_fmt", "yuv420p"], ext: "mov", type: "video/quicktime" },
          };
          const cfg = map[gifFmt] || map.mp4;
          const outName = `gifvideo_${Date.now()}.${cfg.ext}`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
          await ff.run("-i", inName, ...cfg.args, outName);
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, cfg.type)), size: (data as Uint8Array).length });
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        }

        if (tab === "speed") {
          const src = files[0];
          const ext = (src.name.split(".").pop() || "mp4").toLowerCase();
          const inName = wname(ext);
          const outName = `speed_${Date.now()}.mp4`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(src));
          const rate = Math.min(8, Math.max(0.25, speedRate));
          /* setpts 变速视频；音频用 atempo 级联（支持 0.5~2.0） */
          const afilters: string[] = [];
          let r = rate;
          while (r > 2) {
            afilters.push("atempo=2.0");
            r /= 2;
          }
          while (r < 0.5) {
            afilters.push("atempo=0.5");
            r /= 0.5;
          }
          afilters.push(`atempo=${r.toFixed(3)}`);
          await ff.run("-i", inName, "-filter:v", `setpts=${1 / rate}*PTS`, "-filter:a", afilters.join(","), "-c:v", "h264", "-c:a", "aac", "-movflags", "+faststart", outName);
          const data = ff.FS("readFile", outName);
          outs.push({ name: outName, url: URL.createObjectURL(dataToBlob(data, "video/mp4")), size: (data as Uint8Array).length });
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        }

        setOutputs(outs);
        if (!outs.length) throw new Error("没有生成输出文件。");
      });
    } catch {
      /* 错误已由 hook 记录 */
    }
  };

  const rule = FILE_RULES[tab];

  return (
    <div className="fade-rise">
      <ToolHead
        title="视频抽帧 / 倍速"
        lede="抽帧导出图片 · GIF 转视频 · 倍速播放转换 — 全部本地处理，不上传"
        chip={
          <span>
            <IconFilm width={12} height={12} />
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
          <span className="label">{tab === "gif2video" ? "GIF 文件" : "视频文件"}</span>
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
            <span>{tab === "gif2video" ? "点击或拖拽 GIF 到此处" : "点击或拖拽视频到此处"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={tab === "gif2video" ? "image/gif,.gif" : "video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v"}
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
                    <span className="vd-file-meta">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button type="button" className="vc-icon-btn" onClick={() => removeFile(f.name)} title="移除">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "frame" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">抽取时间点（秒，逗号分隔，如 5,15,30）</label>
                <input className="input" placeholder="留空则按间隔抽取" value={frameTimes} onChange={(e) => setFrameTimes(e.target.value)} disabled={busy} />
              </div>
              <div className="vd-field">
                <label className="vc-label">间隔秒数（不填时间点时按此间隔抽帧）</label>
                <input type="number" min={0.1} step={0.5} className="input" value={frameInterval} onChange={(e) => setFrameInterval(parseFloat(e.target.value) || 1)} disabled={busy} />
              </div>
            </div>
          )}

          {tab === "gif2video" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">输出格式</label>
                <select className="input" value={gifFmt} onChange={(e) => setGifFmt(e.target.value)} disabled={busy}>
                  <option value="mp4">MP4</option>
                  <option value="webm">WEBM</option>
                  <option value="mov">MOV</option>
                </select>
              </div>
            </div>
          )}

          {tab === "speed" && (
            <div className="vd-grid">
              <div className="vd-field">
                <label className="vc-label">速度倍率（0.25 ~ 8，&gt;1 加速）</label>
                <input type="number" step={0.25} className="input" value={speedRate} onChange={(e) => setSpeedRate(parseFloat(e.target.value) || 1)} disabled={busy} />
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
        <button type="button" className="btn" onClick={() => { setFiles([]); clearOutputs(); }} disabled={busy}>
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
        <strong>说明：</strong>全部在浏览器本地用 ffmpeg.wasm 处理，文件不上传服务器。
        大文件受浏览器内存限制，建议单文件 ≤ 500MB。
        {!engineReady && !loadingEngine && " 首次处理需下载约 24MB 引擎，之后浏览器会缓存。"}
      </div>
    </div>
  );
}
