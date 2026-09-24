/**
 * 文本文件编码归一化（离线上传与 P2P 接收共用）：
 * 把文本类文件统一转为「带 UTF-8 BOM 的 UTF-8」，
 * 保证接收端在任何系统（含旧版 Windows 记事本按 ANSI 读）都能正确显示中文。
 * 二进制文件（图片 / 压缩包等）不在此范围内，字节保持原样。
 */

const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "css", "scss", "less", "js", "mjs", "cjs", "jsx", "ts", "tsx",
  "json", "html", "htm", "xml", "yml", "yaml", "ini", "cfg", "conf", "log", "csv", "tsv",
  "sh", "bat", "cmd", "ps1", "py", "rb", "php", "sql", "svg", "toml", "env", "properties",
]);

/** 是否文本类文件：优先看 MIME，扩展名兜底（避免二进制文件被误转码） */
export function isTextFile(name: string, type: string): boolean {
  if (/^text\//i.test(type)) return true;
  if (/^application\/(json|xml|javascript|ecmascript|svg\+xml|x-www-form-urlencoded|yaml)/i.test(type)) return true;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_EXTS.has(name.slice(dot + 1).toLowerCase());
}

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * 把文本字节归一化为「带 UTF-8 BOM 的 UTF-8」：
 * - 已有 BOM → 原样返回（未改动）
 * - 合法 UTF-8（无 BOM）→ 加 BOM
 * - 非 UTF-8（如 GBK）→ 转 UTF-8 并加 BOM
 * 返回 { data, changed }，changed=true 表示字节被改动（用于前端提示）。
 */
export function normalizeTextEncoding(
  raw: Uint8Array<ArrayBuffer>,
): { data: Uint8Array<ArrayBuffer>; changed: boolean } {
  const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  if (hasBom) return { data: raw, changed: false };

  let utf8Text: string | null = null;
  try {
    utf8Text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    utf8Text = null;
  }

  if (utf8Text !== null) {
    const out = new Uint8Array(raw.length + 3);
    out.set(UTF8_BOM, 0);
    out.set(raw, 3);
    return { data: out, changed: true };
  }

  // 非 UTF-8：尝试 GBK/GB18030 转码（Web 平台 TextDecoder 内置支持），失败则原样保留
  try {
    const text = new TextDecoder("gb18030").decode(raw);
    const enc = new TextEncoder().encode(text);
    const out = new Uint8Array(enc.length + 3);
    out.set(UTF8_BOM, 0);
    out.set(enc, 3);
    return { data: out, changed: true };
  } catch {
    return { data: raw, changed: false };
  }
}
