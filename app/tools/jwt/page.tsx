"use client";

import { useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconKey, IconShield } from "@/components/icons";

interface Parsed {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  rawHeader: string;
  rawPayload: string;
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function parseJwt(token: string): Parsed | { error: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { error: `JWT 应包含 3 段（header.payload.signature），当前 ${parts.length} 段` };
  try {
    const rawHeader = b64urlDecode(parts[0]);
    const rawPayload = b64urlDecode(parts[1]);
    return {
      header: JSON.parse(rawHeader) as Record<string, unknown>,
      payload: JSON.parse(rawPayload) as Record<string, unknown>,
      signature: parts[2],
      rawHeader,
      rawPayload,
    };
  } catch (e) {
    return { error: `Base64 或 JSON 解析失败：${e instanceof Error ? e.message : "未知错误"}` };
  }
}

function expInfo(payload: Record<string, unknown>): { status: "ok" | "exp" | "none"; text: string } {
  const exp = payload.exp;
  if (typeof exp !== "number") return { status: "none", text: "未含 exp 字段" };
  const left = exp * 1000 - Date.now();
  if (left <= 0) return { status: "exp", text: `已于 ${new Date(exp * 1000).toLocaleString("zh-CN", { hour12: false })} 过期` };
  const m = Math.floor(left / 60000);
  const text = m < 60 ? `${m} 分钟后过期` : m < 1440 ? `${Math.floor(m / 60)} 小时后过期` : `${Math.floor(m / 1440)} 天后过期`;
  return { status: "ok", text: `${text}（${new Date(exp * 1000).toLocaleString("zh-CN", { hour12: false })}）` };
}

export default function JwtPage() {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState("");

  const result = useMemo(() => (input.trim() ? parseJwt(input) : null), [input]);
  const exp = useMemo(
    () => (result && "payload" in result ? expInfo(result.payload) : null),
    [result],
  );

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
        title="JWT 解析"
        lede="解码 Header / Payload，查看签名与过期时间"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地解析 · 不上传
          </span>
        }
      />

      <div className="single-panel">
        <textarea
          className="input textarea mono"
          style={{ minHeight: 90 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴 JWT：eyJhbGciOi… .eyJzdWIiOi… .signature"
          spellCheck={false}
        />

        {result && "error" in result ? (
          <p className="count-hint warn" style={{ marginTop: 10 }}>{result.error}</p>
        ) : result ? (
          <>
            {exp && (
              <div className={`jwt-exp ${exp.status}`}>
                <span className={`lamp ${exp.status === "ok" ? "ok" : exp.status === "exp" ? "err" : "amber"}`} aria-hidden="true" />
                {exp.text}
              </div>
            )}
            <div className="jwt-grid">
              <div className="jwt-seg">
                <div className="panel-head">
                  <span className="label">Header</span>
                  <span className="right">
                    <button className="btn btn-ghost btn-sm" onClick={() => void copy(result.rawHeader, "h")} type="button">
                      {copied === "h" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                      {copied === "h" ? "已复制" : "复制"}
                    </button>
                  </span>
                </div>
                <pre className="jwt-json mono">{JSON.stringify(result.header, null, 2)}</pre>
              </div>
              <div className="jwt-seg">
                <div className="panel-head">
                  <span className="label">Payload</span>
                  <span className="right">
                    <button className="btn btn-ghost btn-sm" onClick={() => void copy(result.rawPayload, "p")} type="button">
                      {copied === "p" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                      {copied === "p" ? "已复制" : "复制"}
                    </button>
                  </span>
                </div>
                <pre className="jwt-json mono">{JSON.stringify(result.payload, null, 2)}</pre>
              </div>
              <div className="jwt-seg">
                <div className="panel-head">
                  <span className="label">Signature</span>
                  <span className="count-hint">未验证</span>
                </div>
                <code className="jwt-sig mono">{result.signature}</code>
              </div>
            </div>
            <p className="count-hint" style={{ marginTop: 8 }}>
              <IconKey width={12} height={12} />
              仅本地解码展示，不校验签名真实性
            </p>
          </>
        ) : (
          <p className="count-hint" style={{ marginTop: 12 }}>粘贴 JWT 后自动解析</p>
        )}
      </div>
    </div>
  );
}
