import { NextRequest, NextResponse } from "next/server";
import { createTransfer } from "@/lib/store";
import { genUniqueCode } from "@/lib/code";
import { clampDownloads, clampTtlHours, countChars, LIMITS, validateFiles } from "@/lib/limits";
import { getStorage } from "@/lib/kv";

/**
 * POST /api/transfer
 * 离线传输：创建一条云端暂存的传输。
 * 支持两种请求体：
 *  - JSON { kind: "text", text: string, ttlHours?, maxDownloads? }
 *  - multipart/form-data  fields=files[], field=kind:"file", field=ttlHours?, field=maxDownloads?
 * ttlHours 范围 1h～7 天（默认 24h）；maxDownloads 范围 1～100（默认 10，仅文件生效）。
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  const { kv } = await getStorage();
  const code = await genUniqueCode(async (c) => (await kv.get(c)) !== null);

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const files = form
      .getAll("files")
      .filter((v): v is File => v instanceof File);

    const err = validateFiles(files);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    const ttlHours = clampTtlHours(form.get("ttlHours"));
    const maxDownloads = clampDownloads(form.get("maxDownloads"));
    const converted: string[] = [];
    const payload = await Promise.all(
      files.map(async (f) => {
        const raw = new Uint8Array(await f.arrayBuffer());
        // 文本类文件统一归一化为「带 UTF-8 BOM 的 UTF-8」：
        // 接收端用任何系统（含旧版 Windows 记事本按 ANSI 读）都能正确显示中文。
        const normalized = isTextFile(f.name, f.type) ? normalizeTextEncoding(raw) : null;
        const data = normalized?.data ?? raw;
        if (normalized?.changed) converted.push(f.name.slice(0, 255));
        return {
          name: f.name.slice(0, 255),
          size: data.byteLength,
          type: f.type || "application/octet-stream",
          data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
        };
      }),
    );
    const record = await createTransfer(
      { kind: "file", files: payload },
      code,
      { ttlMs: ttlHours * 3_600_000, maxDownloads },
    );
    return NextResponse.json({ code, mode: "offline", expiresIn: record.expiresAt - record.createdAt, expiresAt: record.expiresAt, maxDownloads, converted });
  }

  // JSON 文本
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式不正确" }, { status: 400 });
  }
  const b = body as { kind?: unknown; text?: unknown; ttlHours?: unknown; maxDownloads?: unknown };
  if (b.kind !== "text" || typeof b.text !== "string") {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const len = countChars(b.text);
  if (len === 0) {
    return NextResponse.json({ error: "文本不能为空" }, { status: 400 });
  }
  if (len > LIMITS.textMaxChars) {
    return NextResponse.json(
      { error: `文本超过上限（${LIMITS.textMaxChars.toLocaleString()} 字符）` },
      { status: 400 },
    );
  }
  const ttlHours = clampTtlHours(b.ttlHours);
  const maxDownloads = clampDownloads(b.maxDownloads);
  const record = await createTransfer(
    { kind: "text", text: b.text },
    code,
    { ttlMs: ttlHours * 3_600_000, maxDownloads },
  );
  return NextResponse.json({ code, mode: "offline", expiresIn: record.expiresAt - record.createdAt, expiresAt: record.expiresAt, maxDownloads });
}

/** 常见文本扩展名（用于编码归一化判定） */
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "css", "scss", "less", "js", "mjs", "cjs", "jsx", "ts", "tsx",
  "json", "html", "htm", "xml", "yml", "yaml", "ini", "cfg", "conf", "log", "csv", "tsv",
  "sh", "bat", "cmd", "ps1", "py", "rb", "php", "sql", "svg", "toml", "env", "properties",
]);

/** 是否文本类文件：优先看 MIME，扩展名兜底（避免二进制文件被误转码） */
function isTextFile(name: string, type: string): boolean {
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
function normalizeTextEncoding(raw: Uint8Array): { data: Uint8Array; changed: boolean } {
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
