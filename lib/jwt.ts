/**
 * JWT 生成 / 解析 / 签名验证（jwt.io 逻辑还原）。
 * 支持 HS256/384/512、RS256/384/512、ES256/384/512、PS256/384/512、none。
 * 密钥类型：String / Hex / Base64（HS）、PKCS8_PEM / JWK（私钥，签名）、
 *           SPKI_PEM / JWK（公钥，验证）。
 * 全部在浏览器本地完成（Web Crypto + crypto-js），不上传。
 */
import CryptoJS from "crypto-js";

export const HS_ALGS = ["HS256", "HS384", "HS512"] as const;
export const RS_ALGS = ["RS256", "RS384", "RS512"] as const;
export const ES_ALGS = ["ES256", "ES384", "ES512"] as const;
export const PS_ALGS = ["PS256", "PS384", "PS512"] as const;
export const ALL_ALGS = [...HS_ALGS, ...RS_ALGS, ...ES_ALGS, ...PS_ALGS, "none"] as const;
export type JwtAlg = (typeof ALL_ALGS)[number];

export type KeyEncoding = "utf8" | "hex" | "base64" | "pkcs8" | "spki" | "jwk";

export function b64urlFromStr(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function b64urlFromBytes(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Uint8Array → 独立 ArrayBuffer（满足 Web Crypto 的 BufferSource 类型） */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

/* ---------------- HS（HMAC，crypto-js） ---------------- */
function hsKey(key: string, enc: KeyEncoding): CryptoJS.lib.WordArray {
  if (enc === "hex") return CryptoJS.enc.Hex.parse(key);
  if (enc === "base64") return CryptoJS.enc.Base64.parse(key);
  return CryptoJS.enc.Utf8.parse(key);
}

function hsSign(data: Uint8Array, key: string, alg: JwtAlg, keyEncoding: KeyEncoding = "utf8"): string {
  const wa = CryptoJS.lib.WordArray.create(data);
  const kwa = hsKey(key, keyEncoding);
  const sig =
    alg === "HS256"
      ? CryptoJS.HmacSHA256(wa, kwa)
      : alg === "HS384"
        ? CryptoJS.HmacSHA384(wa, kwa)
        : CryptoJS.HmacSHA512(wa, kwa);
  return b64urlFromStr(sig.toString(CryptoJS.enc.Base64).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"));
}

/* ---------------- 辅助 ---------------- */
function rsaHash(alg: JwtAlg): { name: "SHA-256" | "SHA-384" | "SHA-512" } {
  return { name: alg.includes("384") ? "SHA-384" : alg.includes("512") ? "SHA-512" : "SHA-256" };
}

function pemToBytes(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function importPemKey(
  pem: string,
  kind: "private" | "public",
  alg: JwtAlg,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const algo = { name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: rsaHash(alg) };
  return crypto.subtle.importKey(
    kind === "private" ? "pkcs8" : "spki",
    ab(pemToBytes(pem)),
    algo,
    false,
    usages,
  );
}

async function importJwkKey(jwk: JsonWebKey, alg: JwtAlg, kind: "private" | "public"): Promise<CryptoKey> {
  const algo: RsaHashedImportParams | EcKeyImportParams = alg.startsWith("ES")
    ? { name: "ECDSA", namedCurve: esCurve(alg) }
    : { name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: rsaHash(alg) };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    algo,
    false,
    kind === "private" ? ["sign"] : ["verify"],
  );
}

/* ---------------- ES（ECDSA；JWT 用 DER 签名，raw↔DER 转换） ---------------- */
function esCurve(alg: JwtAlg): "P-256" | "P-384" | "P-521" {
  if (alg === "ES384") return "P-384";
  if (alg === "ES512") return "P-521";
  return "P-256";
}

function esLen(alg: JwtAlg): number {
  return alg === "ES384" ? 48 : alg === "ES512" ? 66 : 32;
}

/** IEEE P1363 raw (r||s) → DER 序列 */
function rawToDer(raw: Uint8Array, len: number): Uint8Array {
  const derInt = (b: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i += 1;
    const body = b.slice(i);
    if (body[0] & 0x80) return new Uint8Array([0, ...body]);
    return body;
  };
  const rb = derInt(raw.slice(0, len));
  const sb = derInt(raw.slice(len));
  const total = 6 + rb.length + sb.length;
  const out = new Uint8Array(total);
  out[0] = 0x30;
  out[1] = total - 2;
  out[2] = 0x02;
  out[3] = rb.length;
  out.set(rb, 4);
  out[4 + rb.length] = 0x02;
  out[5 + rb.length] = sb.length;
  out.set(sb, 6 + rb.length);
  return out;
}

/** DER 序列 → IEEE P1363 raw (r||s) */
function derToRaw(der: Uint8Array, len: number): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("DER 序列头缺失");
  const seqLen = der[i++];
  if (seqLen !== der.length - 2) throw new Error("DER 长度不符");
  const readInt = (): Uint8Array => {
    if (der[i++] !== 0x02) throw new Error("DER 整数标记缺失");
    const n = der[i++];
    const body = der.slice(i, i + n);
    i += n;
    return body;
  };
  const rb = readInt();
  const sb = readInt();
  const pad = (b: Uint8Array): Uint8Array => {
    if (b.length > len) return b.slice(b.length - len);
    const out = new Uint8Array(len);
    out.set(b, len - b.length);
    return out;
  };
  const out = new Uint8Array(len * 2);
  out.set(pad(rb), 0);
  out.set(pad(sb), len);
  return out;
}

async function ecImportKey(key: string, keyEncoding: KeyEncoding, alg: JwtAlg, kind: "private" | "public"): Promise<CryptoKey> {
  const algo = { name: "ECDSA", namedCurve: esCurve(alg) };
  if (keyEncoding === "jwk") {
    return crypto.subtle.importKey("jwk", JSON.parse(key) as JsonWebKey, algo, false, kind === "private" ? ["sign"] : ["verify"]);
  }
  return crypto.subtle.importKey(
    kind === "private" ? "pkcs8" : "spki",
    ab(pemToBytes(key)),
    algo,
    false,
    kind === "private" ? ["sign"] : ["verify"],
  );
}

async function esSign(data: Uint8Array, key: string, alg: JwtAlg, keyEncoding: KeyEncoding): Promise<string> {
  const k = await ecImportKey(key, keyEncoding, alg, "private");
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: rsaHash(alg) }, k, ab(data)));
  return b64urlFromBytes(rawToDer(raw, esLen(alg)));
}

async function esVerify(data: Uint8Array, sigB64: string, key: string, alg: JwtAlg, keyEncoding: KeyEncoding): Promise<boolean> {
  const k = await ecImportKey(key, keyEncoding, alg, "public");
  const der = b64urlToBytes(sigB64);
  const raw = derToRaw(der, esLen(alg));
  return crypto.subtle.verify({ name: "ECDSA", hash: rsaHash(alg) }, k, ab(raw), ab(data));
}

/* ---------------- 统一签名 / 验证 ---------------- */
async function sign(
  data: Uint8Array,
  alg: JwtAlg,
  key: string,
  keyEncoding: KeyEncoding,
): Promise<string> {
  if (alg === "none") return "";
  if (alg.startsWith("HS")) return hsSign(data, key, alg, keyEncoding);
  if (alg.startsWith("ES")) return esSign(data, key, alg, keyEncoding);
  let k: CryptoKey;
  if (keyEncoding === "jwk") {
    k = await importJwkKey(JSON.parse(key) as JsonWebKey, alg, "private");
  } else {
    k = await importPemKey(key, "private", alg, ["sign"]);
  }
  if (alg.startsWith("PS")) {
    const sig = await crypto.subtle.sign({ name: "RSA-PSS", saltLength: 32 }, k, ab(data));
    return b64urlFromBytes(sig);
  }
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k, ab(data));
  return b64urlFromBytes(sig);
}

/** 生成 JWT */
export async function signToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  alg: JwtAlg,
  key: string,
  keyEncoding: KeyEncoding = "utf8",
): Promise<string> {
  const h = b64urlFromStr(JSON.stringify(header));
  const p = b64urlFromStr(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = await sign(data, alg, key, keyEncoding);
  return `${h}.${p}.${sig}`;
}

export type VerifyState = "valid" | "invalid" | "unverified" | "unsupported" | "error";

async function verify(
  data: Uint8Array,
  sigB64: string,
  alg: JwtAlg,
  key: string,
  keyEncoding: KeyEncoding,
): Promise<VerifyState> {
  if (alg === "none") return sigB64 === "" ? "valid" : "invalid";
  if (alg.startsWith("HS")) {
    const expected = hsSign(data, key, alg, keyEncoding);
    return expected === sigB64 ? "valid" : "invalid";
  }
  if (alg.startsWith("ES")) {
    return (await esVerify(data, sigB64, key, alg, keyEncoding)) ? "valid" : "invalid";
  }
  let k: CryptoKey;
  if (keyEncoding === "jwk") {
    k = await importJwkKey(JSON.parse(key) as JsonWebKey, alg, "public");
  } else {
    k = await importPemKey(key, "public", alg, ["verify"]);
  }
  const ok = alg.startsWith("PS")
    ? await crypto.subtle.verify({ name: "RSA-PSS", saltLength: 32 }, k, ab(b64urlToBytes(sigB64)), ab(data))
    : await crypto.subtle.verify("RSASSA-PKCS1-v1_5", k, ab(b64urlToBytes(sigB64)), ab(data));
  return ok ? "valid" : "invalid";
}

/** 解析并验证签名（keyEncoding 决定密钥解读方式） */
export async function verifyToken(
  token: string,
  key: string,
  keyEncoding: KeyEncoding = "utf8",
): Promise<{ state: VerifyState; detail: string }> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { state: "error", detail: "JWT 应包含 3 段" };
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlDecode(parts[0])) as Record<string, unknown>;
  } catch {
    return { state: "error", detail: "Header 解析失败" };
  }
  const alg = String(header.alg ?? "") as JwtAlg;
  if (alg === "none") {
    return parts[2] === ""
      ? { state: "valid", detail: "未签名 Token（alg=none）" }
      : { state: "invalid", detail: "alg=none 但存在签名内容" };
  }
  if (!(ALL_ALGS as readonly string[]).includes(alg)) {
    return { state: "unsupported", detail: `不支持的算法 ${alg}` };
  }
  if (!key) {
    return {
      state: "unverified",
      detail: alg.startsWith("HS") ? "输入密钥后可验证签名" : "输入对应公钥后可验证签名",
    };
  }
  try {
    const state = await verify(
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      parts[2],
      alg,
      key,
      keyEncoding,
    );
    const detail =
      state === "valid"
        ? `签名有效（${alg}）`
        : state === "invalid"
          ? "签名不匹配：密钥错误或 Token 已被篡改"
          : "验证失败";
    return { state, detail };
  } catch {
    return { state: "error", detail: "密钥格式无法解析（检查类型与内容）" };
  }
}

/** 人类可读时间输入 → Unix 秒；支持 10 位数字或可解析日期串 */
export function toUnixSeconds(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (/^\d{10}$/.test(t)) return Number(t);
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}
