"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconHash, IconShield } from "@/components/icons";
import { ALGO_LABEL, HASH_ALGOS, hashText, hmacText, type HashAlgo } from "@/lib/crypto";

type Mode = "plain" | "hmac";

export default function HashPage() {
  const [mode, setMode] = useState<Mode>("plain");
  const [input, setInput] = useState("");
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState("");

  const values = useMemo(() => {
    if (!input) return null;
    return HASH_ALGOS.map((algo) => ({
      algo,
      value: mode === "hmac" && secret ? hmacText(input, secret, algo) : hashText(input, algo),
    }));
  }, [input, secret, mode]);

  async function copy(v: string, k: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(k);
      setTimeout(() => setCopied(""), 1400);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fade-rise">
      <ToolHead
        title="Hash 计算"
        lede="MD5 / SHA-1 / SHA-256 / SHA-512，支持 HMAC 签名"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地计算 · 不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="Hash 模式">
        <button data-active={mode === "plain"} onClick={() => setMode("plain")} type="button">
          普通哈希
        </button>
        <button data-active={mode === "hmac"} onClick={() => setMode("hmac")} type="button">
          HMAC 签名
        </button>
      </div>

      <div className="single-panel">
        <div className="panel-head">
          <span className="label">输入</span>
          <span className="count-hint">{input.length} 字符</span>
        </div>
        <textarea
          className="input textarea tall mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入要计算哈希的文本…"
          spellCheck={false}
        />
        {mode === "hmac" && (
          <input
            className="input"
            style={{ marginTop: 10 }}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="HMAC 密钥（Key）"
            spellCheck={false}
          />
        )}
        {values && (
          <div className="hash-list">
            {values.map(({ algo, value }) => (
              <div className="hash-card" key={algo}>
                <div className="hash-card-label">
                  <IconHash width={14} height={14} />
                  {ALGO_LABEL[algo]}
                  {mode === "hmac" && " (HMAC)"}
                </div>
                <code className="hash-card-value">{value}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => void copy(value, algo)} type="button">
                  {copied === algo ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                  {copied === algo ? "已复制" : "复制"}
                </button>
              </div>
            ))}
          </div>
        )}
        {!values && <p className="count-hint" style={{ marginTop: 12 }}>输入文本后自动计算全部哈希</p>}
      </div>
    </div>
  );
}
