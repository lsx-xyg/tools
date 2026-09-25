"use client";

import { useMemo, useState } from "react";
import { UAParser } from "ua-parser-js";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconShield } from "@/components/icons";

type TabId = "ua" | "cookie" | "url" | "query" | "header" | "setcookie" | "request";

const TABS: { id: TabId; label: string; placeholder: string }[] = [
  { id: "request", label: "HTTP 请求", placeholder: "粘贴完整 HTTP 请求原文，自动分离请求行 / 请求头 / 请求体并分别解析，例如：\nPOST /api/login HTTP/1.1\nHost: example.com\nContent-Type: application/json\nAuthorization: Bearer eyJhbGciOi...\nCookie: session=abc; theme=dark\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0\n\n{\"username\":\"admin\",\"password\":\"123\"}" },
  { id: "ua", label: "User-Agent", placeholder: "粘贴 User-Agent 字符串，例如：\nMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  { id: "cookie", label: "Cookie", placeholder: "粘贴 Cookie 字符串，例如：\nsession=abc123; theme=dark; lang=zh-CN; token=eyJhbGciOi..." },
  { id: "url", label: "URL", placeholder: "粘贴完整 URL，例如：\nhttps://user:pass@example.com:8080/path/to/page?q=hello&page=2#section" },
  { id: "query", label: "Query String", placeholder: "粘贴查询字符串，例如：\nq=hello&page=2&sort=asc&tag=前端+开发" },
  { id: "header", label: "HTTP Header", placeholder: "粘贴 HTTP 请求头，每行一个，例如：\nContent-Type: application/json\nAuthorization: Bearer eyJhbGciOi...\nAccept: */*" },
  { id: "setcookie", label: "Set-Cookie", placeholder: "粘贴 Set-Cookie 头值，例如：\nsession=abc123; Path=/; HttpOnly; Secure; Max-Age=3600; SameSite=Lax" },
];

interface KV {
  key: string;
  value: string;
}

/* ========== 解析函数 ========== */

function parseUA(raw: string): KV[] {
  const ua = raw.trim();
  if (!ua) return [];
  try {
    const parser = new UAParser(ua);
    const r = parser.getResult();
    const out: KV[] = [];
    if (r.browser.name) out.push({ key: "浏览器", value: `${r.browser.name}${r.browser.version ? ` ${r.browser.version}` : ""}` });
    if (r.engine.name) out.push({ key: "渲染引擎", value: `${r.engine.name}${r.engine.version ? ` ${r.engine.version}` : ""}` });
    if (r.os.name) out.push({ key: "操作系统", value: `${r.os.name}${r.os.version ? ` ${r.os.version}` : ""}` });
    if (r.device.vendor || r.device.model) out.push({ key: "设备", value: `${r.device.vendor || ""} ${r.device.model || ""}`.trim() });
    if (r.device.type) out.push({ key: "设备类型", value: r.device.type });
    if (r.cpu.architecture) out.push({ key: "CPU 架构", value: r.cpu.architecture });
    return out;
  } catch {
    return [];
  }
}

function parseCookie(raw: string): KV[] {
  const out: KV[] = [];
  for (const part of raw.split(";")) {
    const item = part.trim();
    if (!item) continue;
    const eq = item.indexOf("=");
    if (eq === -1) {
      out.push({ key: item, value: "" });
    } else {
      const k = item.slice(0, eq).trim();
      let v = item.slice(eq + 1).trim();
      try { v = decodeURIComponent(v); } catch { /* keep raw */ }
      out.push({ key: k, value: v });
    }
  }
  return out;
}

function parseURL(raw: string): KV[] {
  const url = raw.trim();
  if (!url) return [];
  try {
    const u = new URL(url);
    const out: KV[] = [
      { key: "协议", value: u.protocol.replace(":", "") },
      { key: "主机", value: u.hostname },
    ];
    if (u.port) out.push({ key: "端口", value: u.port });
    out.push({ key: "路径", value: u.pathname });
    if (u.search) out.push({ key: "查询", value: u.search });
    if (u.hash) out.push({ key: "哈希", value: u.hash });
    if (u.username) out.push({ key: "用户名", value: u.username });
    if (u.password) out.push({ key: "密码", value: u.password });
    out.push({ key: "Origin", value: u.origin });
    return out;
  } catch {
    return [{ key: "错误", value: "无法解析为有效 URL，请检查格式（需包含协议，如 https://）" }];
  }
}

function parseQuery(raw: string): KV[] {
  let q = raw.trim();
  if (q.startsWith("?")) q = q.slice(1);
  if (!q) return [];
  try {
    const params = new URLSearchParams(q);
    const out: KV[] = [];
    for (const [k, v] of params.entries()) {
      out.push({ key: k, value: v });
    }
    return out;
  } catch {
    return [];
  }
}

function parseHeader(raw: string): KV[] {
  const out: KV[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const item = line.trim();
    if (!item) continue;
    const colon = item.indexOf(":");
    if (colon === -1) {
      out.push({ key: item, value: "" });
    } else {
      out.push({ key: item.slice(0, colon).trim(), value: item.slice(colon + 1).trim() });
    }
  }
  return out;
}

function parseSetCookie(raw: string): KV[] {
  const str = raw.trim();
  if (!str) return [];
  const parts = str.split(";").map((s) => s.trim());
  const first = parts[0] || "";
  const eq = first.indexOf("=");
  const out: KV[] = [];
  if (eq !== -1) {
    out.push({ key: "Cookie 名称", value: first.slice(0, eq).trim() });
    out.push({ key: "Cookie 值", value: first.slice(eq + 1).trim() });
  } else {
    out.push({ key: "Cookie 名称", value: first });
  }
  const boolAttrs = new Set(["HttpOnly", "Secure", "Partitioned"]);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const eq2 = p.indexOf("=");
    if (eq2 === -1) {
      const name = p;
      if (boolAttrs.has(name)) {
        out.push({ key: name, value: "✓ 已启用" });
      } else {
        out.push({ key: name, value: "" });
      }
    } else {
      out.push({ key: p.slice(0, eq2).trim(), value: p.slice(eq2 + 1).trim() });
    }
  }
  return out;
}

/* ========== HTTP 完整请求解析 ========== */
interface ParsedRequest {
  method: string;
  path: string;
  version: string;
  headers: KV[];
  uaResult: KV[];
  cookieResult: KV[];
  body: string;
  isJson: boolean;
  queryInPath: KV[];
}

function parseHttpRequest(raw: string): ParsedRequest | null {
  const text = raw.trim();
  if (!text) return null;

  // 分割 headers 和 body（第一个空行）
  const m = text.match(/\r?\n\r?\n/);
  let headerPart = text;
  let body = "";
  if (m && m.index !== undefined) {
    headerPart = text.slice(0, m.index);
    body = text.slice(m.index + m[0].length).trim();
  }

  const lines = headerPart.split(/\r?\n/);
  if (lines.length === 0) return null;

  // 请求行：方法 路径 版本
  const requestLine = lines[0].trim();
  const rlParts = requestLine.split(/\s+/);
  const method = rlParts[0] || "";
  const fullPath = rlParts[1] || "";
  const version = rlParts[2] || "";

  // 路径中的 query string
  const qIdx = fullPath.indexOf("?");
  const path = qIdx === -1 ? fullPath : fullPath.slice(0, qIdx);
  const queryStr = qIdx === -1 ? "" : fullPath.slice(qIdx + 1);
  const queryInPath = queryStr ? parseQuery(queryStr) : [];

  // Headers
  const headers: KV[] = [];
  let uaValue = "";
  let cookieValue = "";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    headers.push({ key, value });
    const lk = key.toLowerCase();
    if (lk === "user-agent") uaValue = value;
    if (lk === "cookie") cookieValue = value;
  }

  const uaResult = uaValue ? parseUA(uaValue) : [];
  const cookieResult = cookieValue ? parseCookie(cookieValue) : [];

  let isJson = false;
  if (body) {
    try { JSON.parse(body); isJson = true; } catch { isJson = false; }
  }

  return { method, path, version, headers, uaResult, cookieResult, body, isJson, queryInPath };
}

const PARSERS: Record<TabId, (raw: string) => KV[]> = {
  ua: parseUA,
  cookie: parseCookie,
  url: parseURL,
  query: parseQuery,
  header: parseHeader,
  setcookie: parseSetCookie,
  request: () => [],
};

/* ========== 结果项组件 ========== */
function ResultItem({ item }: { item: KV }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  }
  return (
    <div className="result-row">
      <span className="result-key">{item.key}</span>
      <span className="result-val" title={item.value}>
        {item.value || <span className="count-hint">（空）</span>}
      </span>
      {item.value && (
        <button className="result-copy" onClick={() => void copy()} type="button" title="复制值">
          {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
        </button>
      )}
    </div>
  );
}

export default function HttpParsePage() {
  const [tab, setTab] = useState<TabId>("ua");
  const [inputs, setInputs] = useState<Record<TabId, string>>({
    ua: "", cookie: "", url: "", query: "", header: "", setcookie: "", request: "",
  });

  const current = TABS.find((t) => t.id === tab)!;
  const raw = inputs[tab];
  const results = useMemo(() => PARSERS[tab](raw), [tab, raw]);
  const parsedRequest = useMemo(() => (tab === "request" ? parseHttpRequest(raw) : null), [tab, raw]);

  return (
    <div className="fade-rise">
      <ToolHead
        title="请求头解析"
        lede="User-Agent / Cookie / URL / Query String / HTTP Header / Set-Cookie 结构化解析"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地解析 · 不上传
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
            onClick={() => setTab(t.id)}
            type="button"
            className="hp-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="transfer-grid">
        {/* 左：输入 */}
        <section className="panel">
          <div className="panel-head">
            <span className="label">{current.label} 输入</span>
            <span className="count-hint">{raw.length} 字符</span>
          </div>
          <div className="panel-body">
            <textarea
              className="input textarea tall"
              value={raw}
              onChange={(e) => setInputs((prev) => ({ ...prev, [tab]: e.target.value }))}
              placeholder={current.placeholder}
              spellCheck={false}
            />
          </div>
        </section>

        {/* 右：结果 */}
        <section className="panel">
          <div className="panel-head">
            <span className="label">解析结果</span>
            <span className="count-hint">{results.length} 项</span>
          </div>
          <div className="panel-body">
            {tab === "request" ? (
              parsedRequest ? (
                <div className="hp-sections">
                  {/* 请求行 */}
                  <div className="hp-section">
                    <div className="hp-section-title">请求行</div>
                    <div className="hp-result-list">
                      <ResultItem item={{ key: "方法", value: parsedRequest.method }} />
                      <ResultItem item={{ key: "路径", value: parsedRequest.path }} />
                      {parsedRequest.queryInPath.length > 0 && (
                        <ResultItem item={{ key: "路径参数", value: parsedRequest.queryInPath.map((q) => `${q.key}=${q.value}`).join("&") }} />
                      )}
                      <ResultItem item={{ key: "协议", value: parsedRequest.version }} />
                    </div>
                  </div>

                  {/* 请求头 */}
                  <div className="hp-section">
                    <div className="hp-section-title">请求头（{parsedRequest.headers.length} 项）</div>
                    <div className="hp-result-list">
                      {parsedRequest.headers.map((item, i) => (
                        <ResultItem key={`h-${i}`} item={item} />
                      ))}
                    </div>
                  </div>

                  {/* User-Agent 详情 */}
                  {parsedRequest.uaResult.length > 0 && (
                    <div className="hp-section">
                      <div className="hp-section-title">User-Agent 详情</div>
                      <div className="hp-result-list">
                        {parsedRequest.uaResult.map((item, i) => (
                          <ResultItem key={`ua-${i}`} item={item} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cookie 详情 */}
                  {parsedRequest.cookieResult.length > 0 && (
                    <div className="hp-section">
                      <div className="hp-section-title">Cookie 详情（{parsedRequest.cookieResult.length} 项）</div>
                      <div className="hp-result-list">
                        {parsedRequest.cookieResult.map((item, i) => (
                          <ResultItem key={`ck-${i}`} item={item} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 路径 Query 详情 */}
                  {parsedRequest.queryInPath.length > 0 && (
                    <div className="hp-section">
                      <div className="hp-section-title">路径 Query 参数（{parsedRequest.queryInPath.length} 项）</div>
                      <div className="hp-result-list">
                        {parsedRequest.queryInPath.map((item, i) => (
                          <ResultItem key={`q-${i}`} item={item} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 请求体 */}
                  {parsedRequest.body && (
                    <div className="hp-section">
                      <div className="hp-section-title">
                        请求体{parsedRequest.isJson ? "（JSON）" : ""}
                      </div>
                      <pre className="hp-body-pre">
                        <code>{parsedRequest.isJson ? JSON.stringify(JSON.parse(parsedRequest.body), null, 2) : parsedRequest.body}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                !raw.trim() ? (
                  <div className="qr-empty">在左侧粘贴完整 HTTP 请求原文后自动分离解析</div>
                ) : (
                  <p className="count-hint warn">无法解析，请检查是否为标准 HTTP 请求格式（需包含请求行，如 GET /path HTTP/1.1）</p>
                )
              )
            ) : !raw.trim() ? (
              <div className="qr-empty">在左侧粘贴内容后自动解析</div>
            ) : results.length === 0 ? (
              <p className="count-hint warn">未解析到有效内容，请检查输入格式</p>
            ) : (
              <div className="hp-result-list">
                {results.map((item, i) => (
                  <ResultItem key={`${item.key}-${i}`} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
