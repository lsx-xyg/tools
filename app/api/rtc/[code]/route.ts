import { NextRequest, NextResponse } from "next/server";
import { getRoom, deleteRoom } from "@/lib/rtc";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string }> };

/**
 * GET /api/rtc/:code — 轮询房间状态（发送方/接收方信令同步）
 * DELETE /api/rtc/:code — 关闭房间
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  const res = await getRoom(code);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({
    code: res.room.code,
    version: res.room.version,
    offer: res.room.offer,
    answer: res.room.answer,
    candidates: res.room.candidates,
    expiresAt: res.room.expiresAt,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  await deleteRoom(code);
  return NextResponse.json({ ok: true });
}
