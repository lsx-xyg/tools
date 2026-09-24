import { NextRequest, NextResponse } from "next/server";
import { createTransfer } from "@/lib/store";
import { genUniqueCode } from "@/lib/code";
import { clampDownloads, clampTtlHours, countChars, LIMITS, validateFiles } from "@/lib/limits";
import { getStorage } from "@/lib/kv";
import { isTextFile, normalizeTextEncoding } from "@/lib/text-encoding";

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
