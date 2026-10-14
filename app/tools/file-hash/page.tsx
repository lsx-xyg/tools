"use client";

import { useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconFileCheck, IconShield, IconTrash } from "@/components/icons";
import { FileDropZone } from "@/components/drop-zone";
import { ALGO_LABEL, HASH_ALGOS, hashFile, type HashAlgo } from "@/lib/crypto";

const MB = 1024 * 1024;

export default function FileHashPage() {
  const [algo, setAlgo] = useState<HashAlgo>("sha256");
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

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
        <div className="seg seg-wide" role="group" aria-label="哈希算法">
          {HASH_ALGOS.map((a) => (
            <button data-active={algo === a} onClick={() => setAlgo(a)} type="button" key={a}>
              {ALGO_LABEL[a]}
            </button>
          ))}
        </div>

        <FileDropZone
          icon={<IconFileCheck width={18} height={18} />}
          label={file ? `已选择：${file.name}` : "拖入文件，或点击选择文件"}
          hint={
            file
              ? `${(file.size / MB).toFixed(file.size < MB ? 2 : 1)} MB${algo === "md5" && file.size > 50 * MB ? " · MD5 大文件较慢，请稍候" : ""}`
              : undefined
          }
          onFiles={(files) => {
            const f = files[0];
            if (f) void run(f);
          }}
          disabled={busy}
        />

        {busy && <p className="count-hint" style={{ marginTop: 10 }}>计算中…</p>}
        {value && (
          <div className="hash-card" style={{ width: "100%", marginTop: 12 }}>
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
        {error && <p className="count-hint warn" style={{ marginTop: 10 }}>{error}</p>}
        {file && !busy && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setFile(null)} type="button">
            <IconTrash width={14} height={14} />
            清除
          </button>
        )}
      </div>
    </div>
  );
}
