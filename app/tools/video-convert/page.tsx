"use client";

import { useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { FileDropZone } from "@/components/drop-zone";
import { dataToBlob, useFFmpeg } from "@/lib/use-ffmpeg";
import { completeTask, createTask, failTask, hasRunningTask, updateTask, useTasks } from "@/lib/task-center";
import { IconDownload, IconLoader, IconRefresh } from "@/components/icons";

const TOOL_NAME = "视频格式转换";

type Fmt = "mp4" | "webm" | "mov" | "mkv" | "gif";

const FORMATS: { id: Fmt; label: string; hint: string }[] = [
  { id: "mp4", label: "MP4", hint: "H.264 + AAC，最通用" },
  { id: "webm", label: "WebM", hint: "VP8 + Opus，网页友好" },
  { id: "mov", label: "MOV", hint: "QuickTime 容器" },
  { id: "mkv", label: "MKV", hint: "Matroska 容器" },
  { id: "gif", label: "GIF", hint: "转动态图（10fps · 480px）" },
];

const MIME: Record<Fmt, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  gif: "image/gif",
};

const INPUT_EXT = /\.(mp4|webm|mov|mkv|m4v|avi|flv|wmv|ts|mpg|mpeg|3gp|ogv|ogg|gif)$/i;

export default function VideoConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState<Fmt>("mp4");
  const [outUrl, setOutUrl] = useState("");
  const [outName, setOutName] = useState("");
  const [err, setErr] = useState("");

  const { runTask, wname, busy, progress, log } = useFFmpeg();
  const tasks = useTasks();
  const running = hasRunningTask(TOOL_NAME);

  async function convert() {
    if (!file) return;
    if (running) {
      setErr("已有转换任务进行中，完成后再提交新的（进度见右下角任务中心）。");
      return;
    }
    setErr("");
    setOutUrl("");
    const taskId = createTask(TOOL_NAME, `${file.name} → ${fmt.toUpperCase()}`);
    updateTask(taskId, { log: "任务已加入后台，可切换工具继续使用。" });
    try {
      await runTask(
        async (ff) => {
          const inName = wname((file.name.split(".").pop() || "mp4").toLowerCase());
          const outName = `out_${Date.now()}.${fmt}`;
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(file));

          /* 同容器体系（mp4/mov/mkv 互转）优先无损 copy；webm/gif 或 copy 失败时转码 */
          if (fmt !== "gif") {
            try {
              await ff.run("-i", inName, "-c", "copy", "-movflags", "+faststart", outName);
            } catch {
              await ff.run(
                "-i", inName,
                "-c:v", "h264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac",
                "-movflags", "+faststart",
                outName
              );
            }
          } else {
            await ff.run("-i", inName, "-vf", "fps=10,scale=480:-2:flags=lanczos", "-f", "gif", outName);
          }

          const data = ff.FS("readFile", outName);
          const blob = dataToBlob(data, MIME[fmt]);
          const base = file.name.replace(/\.[^.]+$/, "");
          const url = URL.createObjectURL(blob);
          setOutName(`${base}.${fmt}`);
          setOutUrl(url);
          completeTask(taskId, url, `${base}.${fmt}`);
          await ff.FS("unlink", inName);
          await ff.FS("unlink", outName);
        },
        {
          onProgress: (p) => updateTask(taskId, { progress: p }),
          onLog: (m) => updateTask(taskId, { log: m }),
        },
      );
    } catch {
      const msg = "转换失败：请确认文件格式受支持（常见视频格式均可）。可在任务中心日志查看具体原因。";
      failTask(taskId, msg);
      setErr(msg);
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="视频格式转换"
        lede="把视频转成 MP4 / WebM / MOV / MKV / GIF — 基于 ffmpeg 在浏览器本地处理，文件不上传"
        chip={
          <span>
            <IconRefresh width={12} height={12} />
            本地转换
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">选择视频</span>
          <span className="right subtle">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.name}` : "支持常见视频格式"}</span>
        </div>
        <div className="panel-body">
          <FileDropZone
            label="拖入视频文件，或点击选择"
            accept="video/*,.gif"
            onFiles={(files) => {
              const f = files[0];
              if (f && INPUT_EXT.test(f.name)) {
                setFile(f);
                setErr("");
                setOutUrl("");
              } else {
                setErr("暂不支持该格式，请选择 mp4 / webm / mov / mkv / m4v / avi / flv / ts 等常见视频。");
              }
            }}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">输出格式</span>
          <span className="right subtle">目标格式</span>
        </div>
        <div className="panel-body">
          <div className="vc-fmt-grid">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`hp-tab ${fmt === f.id ? "hp-tab-on" : ""}`}
                data-active={fmt === f.id}
                onClick={() => setFmt(f.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
              >
                <span style={{ fontWeight: 600 }}>{f.label}</span>
                <span className="subtle" style={{ fontSize: 12 }}>{f.hint}</span>
              </button>
            ))}
          </div>

          {err && <div className="vc-log-error" style={{ marginTop: 12 }}>{err}</div>}

          <div className="vc-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={convert} disabled={!file || busy || running}>
              {busy ? <IconLoader width={14} height={14} /> : <IconDownload width={14} height={14} />}
              {busy ? "转换中…" : running ? "任务进行中…" : `转换为 ${fmt.toUpperCase()}`}
            </button>
            {outUrl && (
              <a className="btn" href={outUrl} download={outName}>
                <IconDownload width={14} height={14} />
                下载 {outName}
              </a>
            )}
          </div>
          {(busy || running) && (
            <p className="count-hint" style={{ marginTop: 10 }}>
              {running ? "已有转换任务在后台运行，可切换其他工具继续使用；进度与下载见右下角「任务中心」。" : "任务已在后台运行，可切换其他工具继续使用；进度与下载见右下角「任务中心」。"}
            </p>
          )}
        </div>
      </div>

      {busy && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <span className="label">转换进度</span>
            <span className="right subtle">{Math.round(progress * 100)}%</span>
          </div>
          <div className="panel-body">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <pre className="vc-log">{log}</pre>
          </div>
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>转换全程在浏览器本地完成，视频不会上传任何服务器。首次转换需要下载 ffmpeg 处理引擎（约 24MB，之后走浏览器缓存）；MP4 / MOV / MKV 之间互转优先无损封装（不重新编码、速度快、画质不变），WebM / GIF 需要重新编码，耗时与视频时长成正比。任务提交后可在后台运行，切换工具不影响转换，进度与完成下载统一在右下角「任务中心」查看。
      </div>
    </div>
  );
}
