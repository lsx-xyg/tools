"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconRefresh, IconShield } from "@/components/icons";
import {
  ALL_ALGS,
  b64urlDecode,
  signToken,
  toUnixSeconds,
  verifyToken,
  type JwtAlg,
  type KeyEncoding,
  type VerifyState,
} from "@/lib/jwt";

type Mode = "parse" | "generate";
type Tab = "basic" | "claims" | "data" | "secret";
type Category = "jws" | "jwe";

const CLAIMS: { key: string; label: string; placeholder: string }[] = [
  { key: "iss", label: "签发人 (iss)", placeholder: "如 https://api.example.com" },
  { key: "sub", label: "主题 (sub)", placeholder: "用户 / 资源标识" },
  { key: "aud", label: "受众 (aud)", placeholder: "https://app.example.com" },
  { key: "exp", label: "过期时间 (exp)", placeholder: "如 2026-12-31 23:59 或 10 位秒" },
  { key: "nbf", label: "生效时间 (nbf)", placeholder: "在此时间之前不生效" },
  { key: "iat", label: "签发时间 (iat)", placeholder: "留空则自动填当前时间" },
  { key: "jti", label: "编号 (jti)", placeholder: "唯一 Token 标识" },
];

/** 密钥类型选项（jwt.io 风格） */
const ALL_KEY_TYPES: { id: KeyEncoding; name: string }[] = [
  { id: "utf8", name: "String" },
  { id: "hex", name: "Hex" },
  { id: "base64", name: "Base64" },
  { id: "pkcs8", name: "PKCS8_PEM" },
  { id: "spki", name: "SPKI_PEM" },
  { id: "jwk", name: "JWK" },
];

function keyTypesFor(alg: JwtAlg, mode: Mode): { id: KeyEncoding; name: string }[] {
  if (alg === "none") return [];
  if (alg.startsWith("HS")) return ALL_KEY_TYPES.slice(0, 3);
  if (mode === "generate") return [ALL_KEY_TYPES[3], ALL_KEY_TYPES[5]];
  return [ALL_KEY_TYPES[4], ALL_KEY_TYPES[5]];
}

function isAsym(alg: JwtAlg): boolean {
  return !alg.startsWith("HS") && alg !== "none";
}

interface Parsed {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  rawHeader: string;
  rawPayload: string;
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

const VERIFY_LABEL: Record<VerifyState, { text: string; cls: string }> = {
  valid: { text: "签名有效", cls: "ok" },
  invalid: { text: "签名不匹配", cls: "exp" },
  unverified: { text: "未验证", cls: "none" },
  unsupported: { text: "不支持", cls: "none" },
  error: { text: "解析错误", cls: "exp" },
};

export default function JwtPage() {
  const [mode, setMode] = useState<Mode>("parse");
  const [copied, setCopied] = useState("");

  // ---- 解析模式 ----
  const [token, setToken] = useState("");
  const [verifyKey, setVerifyKey] = useState("");
  const [verifyKeyType, setVerifyKeyType] = useState<KeyEncoding>("utf8");
  const [verifyState, setVerifyState] = useState<VerifyState | "">("");

  // ---- 生成模式 ----
  const [tab, setTab] = useState<Tab>("basic");
  const [category, setCategory] = useState<Category>("jws");
  const [alg, setAlg] = useState<JwtAlg>("HS256");
  const [typ, setTyp] = useState("JWT");
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [customJson, setCustomJson] = useState("");
  const [keyType, setKeyType] = useState<KeyEncoding>("utf8");
  const [secret, setSecret] = useState("");
  const [pem, setPem] = useState("");
  const [genOut, setGenOut] = useState("");
  const [genError, setGenError] = useState("");

  const parsed = useMemo(() => (token.trim() ? parseJwt(token) : null), [token]);
  const exp = useMemo(
    () => (parsed && "payload" in parsed ? expInfo(parsed.payload) : null),
    [parsed],
  );

  const genKeyTypes = keyTypesFor(alg, "generate");
  const parsedAlg = (parsed && "header" in parsed ? String(parsed.header.alg ?? "HS256") : "HS256") as JwtAlg;
  const verifyKeyTypes = keyTypesFor(parsedAlg, "parse");

  /** 组装 payload；返回 null 表示有错误（错误已写进 genError） */
  function buildPayload(): Record<string, unknown> | null {
    const payload: Record<string, unknown> = {};
    for (const { key } of CLAIMS) {
      const raw = claims[key]?.trim();
      if (!raw) continue;
      if (key === "exp" || key === "nbf" || key === "iat") {
        const sec = toUnixSeconds(raw);
        if (sec === undefined) {
          setGenError(`「${key}」不是有效时间：支持 10 位时间戳或可解析日期`);
          return null;
        }
        payload[key] = sec;
      } else {
        payload[key] = raw;
      }
    }
    if (payload.iat === undefined) payload.iat = Math.floor(Date.now() / 1000);
    if (customJson.trim()) {
      try {
        const extra = JSON.parse(customJson) as Record<string, unknown>;
        Object.assign(payload, extra);
      } catch {
        setGenError("「数据」不是合法 JSON");
        return null;
      }
    }
    return payload;
  }

  /** 自动生成（jwt.io 行为：边输入边出 Token，300ms 防抖） */
  useEffect(() => {
    if (category === "jwe" || !typ) {
      setGenOut("");
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const payload = buildPayload();
        if (!payload) return;
        const key = isAsym(alg) ? pem : secret;
        if (alg !== "none" && !key) {
          setGenOut("");
          setGenError(isAsym(alg) ? "请先在「密钥」填入私钥" : "请先在「密钥」填入密钥");
          return;
        }
        try {
          const out = await signToken({ alg, typ }, payload, alg, key, keyType);
          setGenOut(out);
          setGenError("");
        } catch (e) {
          setGenOut("");
          setGenError(e instanceof Error ? e.message : "生成失败（检查密钥格式）");
        }
      })();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alg, typ, claims, customJson, keyType, secret, pem, category]);

  /** 自动验证（边输入密钥边验签，300ms 防抖） */
  useEffect(() => {
    if (!token.trim()) {
      setVerifyState("");
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const r = await verifyToken(token, verifyKey, verifyKeyType);
        setVerifyState(r.state);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [token, verifyKey, verifyKeyType]);

  /** 算法切换时把密钥类型收敛到可用列表 */
  useEffect(() => {
    const types = keyTypesFor(alg, "generate");
    if (types.length > 0 && !types.some((t) => t.id === keyType)) {
      setKeyType(types[0].id);
    }
  }, [alg, keyType]);

  function resetGen() {
    setTab("basic");
    setCategory("jws");
    setAlg("HS256");
    setTyp("JWT");
    setClaims({});
    setCustomJson("");
    setKeyType("utf8");
    setSecret("");
    setPem("");
    setGenOut("");
    setGenError("");
  }

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
        title="JWT 解析 / 生成"
        lede="解码、签名验证、生成 Token，HS / RS / ES / PS 本地完成"
        chip={
          <span>
            <IconShield width={12} height={12} />
            浏览器本地 · 不上传
          </span>
        }
      />

      <div className="seg seg-wide" role="group" aria-label="JWT 模式">
        <button data-active={mode === "parse"} onClick={() => setMode("parse")} type="button">
          解析
        </button>
        <button data-active={mode === "generate"} onClick={() => setMode("generate")} type="button">
          生成
        </button>
      </div>

      {mode === "parse" ? (
        <div className="single-panel tab-anim" key="parse">
          <textarea
            className="input textarea mono"
            style={{ minHeight: 90 }}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="粘贴 JWT：eyJhbGciOi… .eyJzdWIiOi… .signature"
            spellCheck={false}
          />

          {parsed && "error" in parsed ? (
            <p className="count-hint warn" style={{ marginTop: 10 }}>{parsed.error}</p>
          ) : parsed ? (
            <>
              {exp && (
                <div className={`jwt-exp ${exp.status}`}>
                  <span className={`lamp ${exp.status === "ok" ? "ok" : exp.status === "exp" ? "err" : "amber"}`} aria-hidden="true" />
                  {exp.text}
                </div>
              )}
              {verifyKeyTypes.length > 0 && (
                <div className="tool-row" style={{ marginTop: 12 }}>
                  <select
                    className="input"
                    style={{ width: 130, flexShrink: 0 }}
                    value={verifyKeyTypes.some((t) => t.id === verifyKeyType) ? verifyKeyType : verifyKeyTypes[0].id}
                    onChange={(e) => setVerifyKeyType(e.target.value as KeyEncoding)}
                  >
                    {verifyKeyTypes.map((t) => (
                      <option value={t.id} key={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <input
                    className="input mono"
                    style={{ flex: 1 }}
                    value={verifyKey}
                    onChange={(e) => setVerifyKey(e.target.value)}
                    placeholder={parsedAlg === "none" ? "该 Token 未签名（alg=none）" : "密钥 / 公钥（输入后自动验证签名）"}
                    spellCheck={false}
                    disabled={parsedAlg === "none"}
                  />
                </div>
              )}
              {verifyState && (
                <div className={`jwt-exp ${VERIFY_LABEL[verifyState].cls}`} style={{ marginTop: 8 }}>
                  <span
                    className={`lamp ${VERIFY_LABEL[verifyState].cls === "ok" ? "ok" : VERIFY_LABEL[verifyState].cls === "exp" ? "err" : "amber"}`}
                    aria-hidden="true"
                  />
                  {VERIFY_LABEL[verifyState].text}
                </div>
              )}
              <div className="jwt-grid">
                <div className="jwt-seg">
                  <div className="panel-head">
                    <span className="label">Header</span>
                    <span className="right">
                      <button className="btn btn-ghost btn-sm" onClick={() => void copy(parsed.rawHeader, "h")} type="button">
                        {copied === "h" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                        {copied === "h" ? "已复制" : "复制"}
                      </button>
                    </span>
                  </div>
                  <pre className="jwt-json mono">{JSON.stringify(parsed.header, null, 2)}</pre>
                </div>
                <div className="jwt-seg">
                  <div className="panel-head">
                    <span className="label">Payload</span>
                    <span className="right">
                      <button className="btn btn-ghost btn-sm" onClick={() => void copy(parsed.rawPayload, "p")} type="button">
                        {copied === "p" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                        {copied === "p" ? "已复制" : "复制"}
                      </button>
                    </span>
                  </div>
                  <pre className="jwt-json mono">{JSON.stringify(parsed.payload, null, 2)}</pre>
                </div>
                <div className="jwt-seg">
                  <div className="panel-head">
                    <span className="label">Signature</span>
                    <span className="count-hint">仅本地验证</span>
                  </div>
                  <code className="jwt-sig mono">{parsed.signature}</code>
                </div>
              </div>
            </>
          ) : (
            <p className="count-hint" style={{ marginTop: 12 }}>粘贴 JWT 后自动解析</p>
          )}
        </div>
      ) : (
        <div className="jwt-gen-grid tab-anim" key="generate">
          {/* 左：配置 */}
          <section className="panel">
            <div className="panel-head">
              <span className="label">配置</span>
              <span className="count-hint">浏览器 API 实现，Token 不上传</span>
            </div>
            <div className="panel-body">
              <div className="seg seg-wide" role="group" aria-label="生成配置">
                {(
                  [
                    ["basic", "基础参数"],
                    ["claims", "标准载荷"],
                    ["data", "数据"],
                    ["secret", "密钥"],
                  ] as [Tab, string][]
                ).map(([id, name]) => (
                  <button data-active={tab === id} onClick={() => setTab(id)} type="button" key={id}>
                    {name}
                  </button>
                ))}
              </div>

              <div className="tab-anim" key={tab}>
                {tab === "basic" && (
                  <div className="jwt-form">
                    <div className="form-row">
                      <label>类别</label>
                      <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                        <option value="jws">JWT (JWS)</option>
                        <option value="jwe">Encrypt JWT (JWE)</option>
                      </select>
                      {category === "jwe" && (
                        <span className="count-hint warn">JWE 加密暂未支持，请使用 JWS</span>
                      )}
                    </div>
                    <div className="form-row">
                      <label>算法 (alg)</label>
                      <select
                        className="input"
                        value={alg}
                        onChange={(e) => setAlg(e.target.value as JwtAlg)}
                        disabled={category === "jwe"}
                      >
                        {ALL_ALGS.map((a) => (
                          <option value={a} key={a}>{a}</option>
                        ))}
                      </select>
                      <span className="count-hint">
                        {alg === "none" ? "不签名" : alg.startsWith("HS") ? "HMAC 对称密钥" : alg.startsWith("ES") ? "ECDSA 椭圆曲线" : "RSA（需 PEM 密钥）"}
                      </span>
                    </div>
                    <div className="form-row">
                      <label>类型 (typ)</label>
                      <input className="input" value={typ} onChange={(e) => setTyp(e.target.value)} spellCheck={false} />
                    </div>
                  </div>
                )}

                {tab === "claims" && (
                  <div className="jwt-form">
                    {CLAIMS.map((c) => (
                      <div className="form-row" key={c.key}>
                        <label>{c.label}</label>
                        <input
                          className="input"
                          value={claims[c.key] ?? ""}
                          onChange={(e) => setClaims((prev) => ({ ...prev, [c.key]: e.target.value }))}
                          placeholder={c.placeholder}
                          spellCheck={false}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {tab === "data" && (
                  <div className="jwt-form">
                    <div className="form-row col">
                      <label>自定义载荷（JSON）</label>
                      <textarea
                        className="input textarea mono"
                        style={{ minHeight: 180 }}
                        value={customJson}
                        onChange={(e) => setCustomJson(e.target.value)}
                        placeholder='如 {"name": "John", "admin": true}'
                        spellCheck={false}
                      />
                      <p className="count-hint">留空则不附加自定义字段</p>
                    </div>
                  </div>
                )}

                {tab === "secret" && (
                  <div className="jwt-form">
                    {alg === "none" ? (
                      <p className="count-hint">算法为 none：Token 不签名，无需密钥</p>
                    ) : isAsym(alg) ? (
                      <>
                        <div className="form-row">
                          <label>密钥类型</label>
                          <select
                            className="input"
                            style={{ width: 140 }}
                            value={keyType}
                            onChange={(e) => setKeyType(e.target.value as KeyEncoding)}
                          >
                            {genKeyTypes.map((t) => (
                              <option value={t.id} key={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <span className="count-hint">{keyType === "jwk" ? "JSON Web Key（私钥）" : "PKCS#8 私钥 PEM"}</span>
                        </div>
                        <div className="form-row col">
                          <label>{keyType === "jwk" ? "私钥 JWK" : "私钥 PEM"}</label>
                          <textarea
                            className="input textarea mono"
                            style={{ minHeight: 150 }}
                            value={pem}
                            onChange={(e) => setPem(e.target.value)}
                            placeholder={keyType === "jwk" ? '{"kty":"RSA","n":"…","d":"…"}' : "-----BEGIN PRIVATE KEY-----…"}
                            spellCheck={false}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-row">
                          <label>密钥类型</label>
                          <select
                            className="input"
                            style={{ width: 140 }}
                            value={keyType}
                            onChange={(e) => setKeyType(e.target.value as KeyEncoding)}
                          >
                            {genKeyTypes.map((t) => (
                              <option value={t.id} key={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <span className="count-hint">
                            {keyType === "hex" ? "十六进制字节" : keyType === "base64" ? "Base64 字节" : "普通字符串"}
                          </span>
                        </div>
                        <div className="form-row">
                          <label>密钥</label>
                          <input
                            className="input mono"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="请输入密钥"
                            spellCheck={false}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 右：结果 */}
          <section className="panel jwt-result">
            <div className="panel-head">
              <span className="label">JSON Web Token</span>
              <span className="right">
                {genOut && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void copy(genOut, "g")} type="button">
                    {copied === "g" ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                    {copied === "g" ? "已复制" : "复制"}
                  </button>
                )}
              </span>
            </div>
            <div className="panel-body">
              <div className="tool-row">
                <button className="btn btn-ghost btn-sm" onClick={resetGen} type="button">
                  <IconRefresh width={14} height={14} />
                  重置
                </button>
                <span className="count-hint" style={{ marginLeft: "auto" }}>
                  {alg === "none" ? "未签名" : `${alg} · ${keyType === "jwk" ? "JWK" : isAsym(alg) ? "私钥 PEM" : keyType}`}
                </span>
              </div>
              {genError && <p className="count-hint warn" style={{ marginTop: 10 }}>{genError}</p>}
              {genOut ? (
                <code className="jwt-token mono">{genOut}</code>
              ) : (
                <p className="count-hint" style={{ marginTop: 14 }}>
                  配置左侧参数，Token 实时生成…
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
