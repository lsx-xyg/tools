/**
 * JWT 生成 / 解析 / 签名验证（HS 系 + RS 系）。
 * 全部在浏览器本地完成（Web Crypto + crypto-js），不上传。
 */
import CryptoJS from "crypto-js";

export const HS_ALGS = ["HS256", "HS384", "HS512"] as const;
export const RS_ALGS = ["RS256", "RS384", "RS512"] as const;
export const ALL_ALGS = [...HS_ALGS, ...RS_ALGS] as const;
export type JwtAlg = (typeof ALL_ALGS)[number];

/** HMAC 密钥的编码形式 */
export type KeyEncoding = "utf8" | "hex" | "base64";

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

function hsSign(data: Uint8Array, key: string, alg: JwtAlg, keyEncoding: KeyEncoding = "utf8"): string {
  const wa = CryptoJS.lib.WordArray.create(data);
  const kwa =
    keyEncoding === "hex"
      ? CryptoJS.enc.Hex.parse(key)
      : keyEncoding === "base64"
        ? CryptoJS.enc.Base64.parse(key)
        : CryptoJS.enc.Utf8.parse(key);
  const sig =
    alg === "HS256"
      ? CryptoJS.HmacSHA256(wa, kwa)
      : alg === "HS384"
        ? CryptoJS.HmacSHA384(wa, kwa)
        : CryptoJS.HmacSHA512(wa, kwa);
  return b64urlFromStr(sig.toString(CryptoJS.enc.Base64).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"));
}

function importRsaKey(pem: string, kind: "private" | "public", alg: JwtAlg): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const hash = { name: alg === "RS256" ? "SHA-256" : alg === "RS384" ? "SHA-384" : "SHA-512" };
  return crypto.subtle.importKey(
    kind === "private" ? "pkcs8" : "spki",
    ab(bytes),
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    kind === "private" ? ["sign"] : ["verify"],
  );
}

/** Uint8Array → 独立 ArrayBuffer（满足 Web Crypto 的 BufferSource 类型） */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function rsSign(data: Uint8Array, pem: string, alg: JwtAlg): Promise<string> {
  const key = await importRsaKey(pem, "private", alg);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, ab(data));
  return b64urlFromBytes(sig);
}

/** 生成 JWT；RS 系需要私钥 PEM */
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
  const sig = alg.startsWith("HS")
    ? hsSign(data, key, alg, keyEncoding)
    : await rsSign(data, key, alg);
  return `${h}.${p}.${sig}`;
}

export type VerifyState = "valid" | "invalid" | "unverified" | "unsupported" | "error";

/** 解析并验证签名：HS 用密钥重算比对；RS 用公钥 PEM 验证 */
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
  const alg = String(header.alg ?? "");
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (alg.startsWith("HS")) {
    if (!key) return { state: "unverified", detail: "HMAC 算法：输入密钥后可验证签名" };
    const expected = hsSign(data, key, alg as JwtAlg, keyEncoding);
    return expected === parts[2]
      ? { state: "valid", detail: "签名有效（HMAC 重算一致）" }
      : { state: "invalid", detail: "签名不匹配：密钥错误或 Token 已被篡改" };
  }
  if (alg.startsWith("RS")) {
    if (!key) return { state: "unverified", detail: "RSA 算法：输入公钥 PEM 后可验证签名" };
    try {
      const pub = await importRsaKey(key, "public", alg as JwtAlg);
      const ok = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        pub,
        ab(b64urlToBytes(parts[2])),
        ab(data),
      );
      return ok
        ? { state: "valid", detail: "签名有效（RSA 公钥验证通过）" }
        : { state: "invalid", detail: "签名不匹配：公钥错误或 Token 已被篡改" };
    } catch {
      return { state: "error", detail: "公钥 PEM 无法解析" };
    }
  }
  return { state: "unsupported", detail: `不支持的算法 ${alg}，仅支持 HS / RS 系列` };
}

/** 人类可读时间输入 → Unix 秒；支持 10 位数字或可解析日期串 */
export function toUnixSeconds(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (/^\d{10}$/.test(t)) return Number(t);
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}
