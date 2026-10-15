"use client";

/* ffmpeg.wasm 0.11 共享引擎（UMD 自托管，绕开打包器对 import.meta.resolve 的限制）
   每次 run 后重建实例：0.11 ST core 的 parseArgs 每次 run 泄漏 wasm 内存（官方已知 bug） */
import { useCallback, useRef, useState } from "react";

export interface FFmpegInstance {
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

export function dataToBlob(data: unknown, type: string): Blob {
  const part = (data instanceof Uint8Array ? data.buffer : data) as BlobPart;
  return new Blob([part], { type });
}

export function useFFmpeg() {
  const ffRef = useRef<FFmpegInstance | null>(null);
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [log, setLog] = useState("");

  const appendLog = useCallback((msg: string) => {
    setLog((p) => (p ? p + "\n" : "") + msg);
  }, []);

  /* 加载 ffmpeg 引擎（懒加载，首次处理时才下载核心） */
  const ensureEngine = useCallback(async () => {
    if (ffRef.current) return ffRef.current;
    setLoadingEngine(true);
    setLog("正在加载处理引擎（首次需要下载约 24MB，之后浏览器缓存）…");
    try {
      if (!window.FFmpeg) await loadScript("/ffmpeg/lib/ffmpeg.min.js");
      const { createFFmpeg } = window.FFmpeg!;
      const corePath = new URL("/ffmpeg/ffmpeg-core.js", window.location.href).href;
      const ff = createFFmpeg({ log: true, corePath, mainName: "main" });
      ff.setLogger(({ message }) => {
        if (message) appendLog(message);
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
  }, [appendLog]);

  /* 执行一次任务：先 ensureEngine，跑完 run 后销毁实例 */
  const runTask = useCallback(
    async (task: (ff: FFmpegInstance) => Promise<void>) => {
      setBusy(true);
      setProgress(0);
      setLog("");
      try {
        const ff = await ensureEngine();
        await task(ff);
      } catch (e) {
        appendLog(
          `处理失败：${e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : JSON.stringify(e)}`
        );
        throw e;
      } finally {
        setBusy(false);
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
    },
    [ensureEngine, appendLog]
  );

  /* 批量任务：每个 task 独立跑一次 run 并重建实例（规避 0.11 parseArgs 内存泄漏） */
  const runBatch = useCallback(
    async (tasks: Array<(ff: FFmpegInstance) => Promise<void>>) => {
      setBusy(true);
      setProgress(0);
      setLog("");
      try {
        for (const t of tasks) {
          const ff = await ensureEngine();
          await t(ff);
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
      } catch (e) {
        appendLog(
          `处理失败：${e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : JSON.stringify(e)}`
        );
        throw e;
      } finally {
        setBusy(false);
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
    },
    [ensureEngine, appendLog]
  );

  const wname = (ext: string) => `in_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;

  return { ensureEngine, runTask, runBatch, wname, loadingEngine, busy, progress, engineReady, log, setLog, appendLog };
}
