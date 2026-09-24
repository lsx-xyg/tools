"use client";

import { useRef, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconFileCheck, IconShield, IconTrash, IconUpload } from "@/components/icons";
import { ALGO_LABEL, HASH_ALGOS, hashFile, type HashAlgo } from "@/lib/crypto";

const MB = 1024 * 1024;

export default function FileHashPage() {
  const [algo, setAlgo] = useState<HashAlgo>("sha256");
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(f: File) {
    setFile(f);
    setValue("");
    setError("");
    setBusy(true);
    try {
      // 异步让出主线程，UI 能先更新 busy 状态
      await new Promise((r) => setTimeout(r, 20));
      const h = await hashFile(f, algo);
      setValue(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "计算失败");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="文件哈希校验"
        lede="计算本地文件的 MD5 / SHA 摘要"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地计算 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <div className="tool-row">
          <div className="seg" role="group" aria-label="哈希算法">
            {HASH_ALGOS.map((a) => (
              <button data-active={algo === a} onClick={() => setAlgo(a)} type="button" key={a}>
                {ALGO_LABEL[a]}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <input
            ref={inputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(f);
              e.currentTarget.value = "";
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => inputRef.current?.click()} type="button" disabled={busy}>
            <IconUpload width={14} height={14} />
            选择文件
          </button>
        </div>

        <div
          className={`drop-zone ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void run(f);
          }}
        >
          <IconFileCheck width={22} height={22} />
          {file ? (
            <div className="file-meta">
              <b>{file.name}</b>
              <span className="count-hint">
                {(file.size / MB).toFixed(file.size < MB ? 2 : 1)} MB
                {algo === "md5" && file.size > 50 * MB && " · MD5 大文件较慢，请稍候"}
              </span>
            </div>
          ) : (
            <p>
              拖拽文件到这里，或点击右上角选择
            </p>
          )}
          {busy && <p className="count-hint">计算中…</p>}
          {value && (
            <div className="hash-card" style={{ width: "100%" }}>
              <div className="hash-card-label">
                {ALGO_LABEL[algo]}
              </div>
              <code className="hash-card-value">{value}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => void copy()} type="button">
                {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          )}
          {error && <p className="count-hint warn">{error}</p>}
          {file && !busy && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)} type="button">
              <IconTrash width={14} height={14} />
              清除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
