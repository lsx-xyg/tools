/**
 * 全站密码认证（Worker 层拦截）：
 * - 密码存于环境变量 SITE_PASSWORD，不写死在代码
 * - 验证通过后写入 30 天有效 HttpOnly Cookie
 * - 未验证一律返回极简密码页（连 API 一并拦截）
 * 纯函数，可单测。
 */

export const AUTH_COOKIE = "site_auth";
export const AUTH_VALUE = "1";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

export function hasAuth(cookie: string | null): boolean {
  return (cookie ?? "")
    .split(";")
    .some((c) => c.trim() === `${AUTH_COOKIE}=${AUTH_VALUE}`);
}

/** 恒时比较，避免时序侧信道；未配置密码时一律拒绝（不裸奔） */
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

export function authSetCookie(secure: boolean): string {
  return `${AUTH_COOKIE}=${AUTH_VALUE}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
