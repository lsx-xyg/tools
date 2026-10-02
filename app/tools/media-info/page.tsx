"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { useFFmpeg } from "@/lib/use-ffmpeg";
import { IconInfo, IconTrash, IconLoader, IconUpload, IconChevron } from "@/components/icons";

interface StreamInfo {
  index: string;
  type: string;
  codec: string;
  detail: string;
}

interface MediaInfo {
  file: string;
  size: number;
  container: string;
  duration: string;
  bitrate: string;
  streams: StreamInfo[];
}

const MEDIA_EXT = /\.(mp4|webm|mov|avi|mkv|m4v|gif|mp3|wav|m4a|ogg|flac|aac|opus)$/i;

export default function MediaInfoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<MediaInfo[]>([]);
  const [rawLog, setRawLog] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [err, setErr] = useState("");

  const { ensureEngine, runTask, wname, busy, loadingEngine, engineReady, log, setLog } = useFFmpeg();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => MEDIA_EXT.test(f.name));
    if (!arr.length) return;
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  }, []);

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  useEffect(() => {
    return () => {
      setResults([]);
    };
  }, []);

  /* 解析 ffmpeg stderr 输出 */
  const parseInfo = useCallback((file: File, lines: string[]): MediaInfo | null => {
    const text = lines.join("\n");
    const m = /Input #\d+, ([^,]+),/.exec(text);
    const container = m ? m[1].trim() : "未知";
    const dur = /Duration: ([^,]+)/.exec(text);
    const br = /bitrate: (\d+ kb\/s)/.exec(text);
    const streams: StreamInfo[] = [];
    const re = /Stream #(\d+:\d+)(?:\([^)]*\))?: (Video|Audio|Data|Subtitle): ([^ ]+)(.*)/g;
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(text))) {
      const [, index, type, codec, detail] = hit;
      let detailText = detail.replace(/\(default\)|\(und\)/g, "").trim();
      if (type === "Video") {
        const res = /, (\d{2,5}x\d{2,5})/.exec(detailText);
        const fps = /, ([\d.]+) fps/.exec(detailText);
        const kb = /, ([\d.]+) kb\/s/.exec(detailText);
        detailText = [res?.[1], fps ? `${fps[1]} fps` : null, kb ? `${kb[1]} kb/s` : null].filter(Boolean).join(" · ");
      } else if (type === "Audio") {
        const hz = /, (\d+) Hz/.exec(detailText);
        const ch = /, (mono|stereo|5\.1)/.exec(detailText);
        const kb = /, ([\d.]+) kb\/s/.exec(detailText);
        detailText = [hz ? `${hz[1]} Hz` : null, ch?.[1], kb ? `${kb[1]} kb/s` : null].filter(Boolean).join(" · ");
      }
      streams.push({ index, type, codec, detail: detailText });
    }
    if (!streams.length) return null;
    return {
      file: file.name,
      size: file.size,
      container,
      duration: dur ? dur[1].trim() : "未知",
      bitrate: br ? br[1] : "未知",
      streams,
    };
  }, []);

  const analyze = async () => {
    if (!files.length) return;
    setErr("");
    setResults([]);
    setRawLog("");
    setShowRaw(false);
    const allRaw: string[] = [];
    try {
      await runTask(async (ff) => {
        const infoList: MediaInfo[] = [];
        const linesAll: string[] = [];
        for (const f of files) {
          const ext = (f.name.split(".").pop() || "bin").toLowerCase();
          const inName = wname(ext);
          const ffLines: string[] = [];
          ff.setLogger(({ message }) => {
            if (message) ffLines.push(message);
          });
          await ff.FS("writeFile", inName, await window.FFmpeg!.fetchFile(f));
          try {
            /* ffmpeg -i 无输出文件时会报错退出，但流信息已完整打印到 stderr */
            await ff.run("-i", inName);
          } catch {
            /* 预期：缺少输出文件 */
          }
          const info = parseInfo(f, ffLines);
          if (info) infoList.push(info);
          linesAll.push(`===== ${f.name} =====\n` + ffLines.join("\n"));
          await ff.FS("unlink", inName);
        }
        setResults(infoList);
        setRawLog(linesAll.join("\n"));
        if (!infoList.length) setErr("未能解析出媒体信息，请确认文件为有效音视频。");
      });
    } catch {
      /* 错误已由 hook 记录 */
    }
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="媒体信息"
        lede="查看视频 / 音频文件的编码、码率、分辨率、时长等元数据 — 本地解析，文件不上传"
        chip={
          <span>
            <IconInfo width={12} height={12} />
            本地解析
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">媒体文件</span>
          <span className="right subtle">上传 1 ~ 10 个音视频</span>
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
            <span>点击或拖拽音视频到此处</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.gif,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus"
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
                    <span className="vd-file-meta">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button type="button" className="vc-icon-btn" onClick={() => removeFile(f.name)} title="移除">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" className="btn-primary" onClick={analyze} disabled={busy || !files.length}>
          {busy ? <IconLoader width={14} height={14} /> : null}
          {busy ? "解析中…" : "解析媒体信息"}
        </button>
        <button type="button" className="btn" onClick={() => { setFiles([]); setResults([]); setRawLog(""); setErr(""); }} disabled={busy}>
          清空
        </button>
      </div>

      {(busy || loadingEngine) && (
        <div className="vc-note">
          {loadingEngine ? "正在加载解析引擎（首次约 24MB）…" : "解析中…"}
        </div>
      )}

      {err && <div className="vc-log-error">{err}</div>}

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {results.map((info) => (
            <div key={info.file} className="panel">
              <div className="panel-head">
                <span className="label">{info.file}</span>
                <span className="right subtle">{(info.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="panel-body">
                <div className="vd-grid">
                  <div className="vd-field">
                    <span className="vc-label">容器</span>
                    <div className="mi-value">{info.container}</div>
                  </div>
                  <div className="vd-field">
                    <span className="vc-label">时长</span>
                    <div className="mi-value">{info.duration}</div>
                  </div>
                  <div className="vd-field">
                    <span className="vc-label">总码率</span>
                    <div className="mi-value">{info.bitrate}</div>
                  </div>
                </div>
                <table className="mi-table">
                  <thead>
                    <tr>
                      <th>流</th>
                      <th>类型</th>
                      <th>编码</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.streams.map((s) => (
                      <tr key={s.index}>
                        <td className="mono">{s.index}</td>
                        <td>{s.type === "Video" ? "🎬 视频" : s.type === "Audio" ? "🎵 音频" : s.type}</td>
                        <td className="mono">{s.codec}</td>
                        <td className="subtle">{s.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {rawLog && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <button type="button" className="vc-link" onClick={() => setShowRaw((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconChevron width={12} height={12} />
              {showRaw ? "收起原始输出" : "查看原始输出"}
            </button>
          </div>
          {showRaw && (
            <div className="panel-body">
              <pre className="mi-raw">{rawLog}</pre>
            </div>
          )}
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>解析在浏览器本地完成，文件不上传服务器。
        {!engineReady && !loadingEngine && " 首次解析需下载约 24MB 引擎，之后浏览器会缓存。"}
      </div>
    </div>
  );
}
