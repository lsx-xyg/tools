import { NextRequest, NextResponse } from "next/server";
import { getTransfer, consumeDownload } from "@/lib/store";
import { getStorage } from "@/lib/kv";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string; key: string }> };

/**
 * GET /api/transfer/:code/file/:key — 下载离线传输的单个文件（支持 Range）
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { code, key } = await params;
  if (!isCode(code) || !/^\d$/.test(key)) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }

  const res = await getTransfer(code);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  const { record } = res;
  const meta = record.files?.[Number(key)];
  if (!meta) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const consumed = await consumeDownload(record);
  if (!consumed.ok) {
    const status = consumed.reason === "expired" ? 410 : 429;
    return NextResponse.json({ error: consumed.reason }, { status });
  }

  const { rawR2, obj, isLocal } = await getStorage();
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`;

  if (!isLocal && rawR2) {
    // 生产：R2 流式 + 断点续传
    const r2 = rawR2 as {
      get(
        k: string,
        opts?: { range?: { offset: number; length: number } },
      ): Promise<{
        body: ReadableStream | null;
        size: number;
        httpMetadata?: { contentType?: string };
      } | null>;
    };
    const rangeHeader = req.headers.get("range");
    const parsed = rangeHeader ? parseRange(rangeHeader, meta.size) : null;
    if (rangeHeader && parsed === null) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${meta.size}` },
      });
    }
    const obj2 = await r2.get(meta.key, parsed ? { range: { offset: parsed.offset, length: parsed.length } } : undefined);
    if (!obj2 || !obj2.body) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", meta.type || "application/octet-stream");
    headers.set("Content-Disposition", disposition);
    headers.set("Accept-Ranges", "bytes");
    if (parsed) {
      headers.set("Content-Length", String(parsed.length));
      const end = parsed.offset + parsed.length - 1;
      headers.set("Content-Range", `bytes ${parsed.offset}-${end}/${meta.size}`);
    } else {
      headers.set("Content-Length", String(obj2.size));
    }
    return new Response(obj2.body, { status: parsed ? 206 : 200, headers });
  }

  // 本地开发
  const local = await obj?.get(meta.key);
  if (!local) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  const headers = new Headers();
  headers.set("Content-Type", meta.type || "application/octet-stream");
  headers.set("Content-Length", String(local.size));
  headers.set("Content-Disposition", disposition);
  return new Response(local.buffer as BodyInit, { status: 200, headers });
}

/** 解析 Range: bytes=start-end / bytes=start- / bytes=-suffix */
function parseRange(h: string, total: number): { offset: number; length: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  if (a === "") {
    const n = Number(b);
    if (n <= 0) return null;
    const offset = Math.max(0, total - n);
    return { offset, length: Math.min(n, total) };
  }
  const offset = Number(a);
  if (offset >= total) return null;
  const end = b === "" ? total - 1 : Math.min(Number(b), total - 1);
  if (offset > end) return null;
  return { offset, length: end - offset + 1 };
}
