import { NextRequest, NextResponse } from "next/server";
import { getTransfer, deleteTransfer } from "@/lib/store";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string }> };

/**
 * GET /api/transfer/:code — 取回离线传输内容
 * DELETE /api/transfer/:code — 立即删除（发送端主动销毁）
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  const res = await getTransfer(code);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  const { record } = res;
  const body = {
    code: record.code,
    kind: record.kind,
    text: record.kind === "text" ? record.text : undefined,
    files: record.kind === "file" ? record.files?.map((f) => ({ name: f.name, size: f.size, type: f.type, index: f.key.split("/")[1] })) : undefined,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    downloadsLeft: record.kind === "file" ? Math.max(0, record.maxDownloads - record.downloads) : undefined,
    maxDownloads: record.maxDownloads,
  };
  return NextResponse.json(body);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  const res = await getTransfer(code);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  await deleteTransfer(res.record);
  return NextResponse.json({ ok: true });
}
