/** 随机 6 位数字提取码生成 */

export function genCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1_000_000).padStart(6, "0");
}

export function isCode(s: string): boolean {
  return /^\d{6}$/.test(s);
}

/** 生成一个不与现有 key 冲突的提取码 */
export async function genUniqueCode(
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    if (!(await exists(code))) return code;
  }
  throw new Error("无法生成提取码，请稍后重试");
}
