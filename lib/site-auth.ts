/**
 * 全站密码认证（Worker 层拦截）：
 * - 密码存于环境变量 SITE_PASSWORD，不写死在代码
 * - 验证通过后写入 30 天有效 HttpOnly Cookie，Cookie 值为 HMAC 签名 token
 * - 每次请求验证签名有效性 + 过期时间，不可伪造
 * - 未验证一律返回极简密码页（连 API 一并拦截）
 */

export const AUTH_COOKIE = "site_auth";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

/* ---------- 工具函数 ---------- */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** 生成签名 token: expireAt.base64url(signature) */
export async function generateAuthToken(secret: string, maxAge = MAX_AGE_SECONDS): Promise<string> {
  const expireAt = Math.floor(Date.now() / 1000) + maxAge;
  const payload = String(expireAt);
  const key = await getSigningKey(secret);
  const enc = new TextEncoder();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${toBase64Url(sig)}`;
}

/** 验证 token: 签名正确且未过期 */
export async function verifyAuthToken(token: string, secret: string): Promise<boolean> {
  try {
    const dot = token.indexOf(".");
    if (dot < 0) return false;
    const payload = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    if (!payload || !sigB64) return false;

    const expireAt = parseInt(payload, 10);
    if (isNaN(expireAt) || expireAt < Math.floor(Date.now() / 1000)) return false;

    const key = await getSigningKey(secret);
    const enc = new TextEncoder();
    const sigBytes = fromBase64Url(sigB64);
    return crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, enc.encode(payload));
  } catch {
    return false;
  }
}

/* ---------- 对外 API ---------- */

/** 从 Cookie 头解析出 auth token */
export function extractAuthToken(cookie: string | null): string | null {
  if (!cookie) return null;
  const prefix = `${AUTH_COOKIE}=`;
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

/** 同步快速检查（只看有没有 cookie，不验证签名——用于非关键路径快速拒绝） */
export function hasAuthCookie(cookie: string | null): boolean {
  return extractAuthToken(cookie) !== null;
}

/** 恒时比较密码，避免时序侧信道；未配置密码时一律拒绝（不裸奔） */
export function checkPassword(input: string | undefined, expected: string | undefined): boolean {
  if (typeof input !== "string" || typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i += 1) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function authSetCookie(token: string, secure: boolean): string {
  return `${AUTH_COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
