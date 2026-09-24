import { NextRequest, NextResponse } from "next/server";
import { createTransfer } from "@/lib/store";
import { genUniqueCode } from "@/lib/code";
import { countChars, LIMITS, validateFiles } from "@/lib/limits";
import { getStorage } from "@/lib/kv";

/**
 * POST /api/transfer
 * 离线传输：创建一条云端暂存（24h）的传输。
 * 支持两种请求体：
 *  - JSON { kind: "text", text: string }
 *  - multipart/form-data  fields=files[], field=kind:"file"
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
    const payload = await Promise.all(
      files.map(async (f) => ({
        name: f.name.slice(0, 255),
        size: f.size,
        type: f.type || "application/octet-stream",
        data: await f.arrayBuffer(),
      })),
    );
    const record = await createTransfer({ kind: "file", files: payload }, code);
    return NextResponse.json({ code, mode: "offline", expiresIn: LIMITS.offlineTtlMs, expiresAt: record.expiresAt });
  }

  // JSON 文本
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式不正确" }, { status: 400 });
  }
  const b = body as { kind?: unknown; text?: unknown };
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
  const record = await createTransfer({ kind: "text", text: b.text }, code);
  return NextResponse.json({ code, mode: "offline", expiresIn: LIMITS.offlineTtlMs, expiresAt: record.expiresAt });
}
