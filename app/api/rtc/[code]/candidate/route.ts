import { NextRequest, NextResponse } from "next/server";
import { addCandidate } from "@/lib/rtc";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string }> };

/**
 * POST /api/rtc/:code/candidate — 双方提交 ICE candidate
 * body: { role: "sender" | "receiver", sdp: string, seq: number }
 * seq 为客户端单调递增序号，保证候选各自独立成 key、互不覆盖。
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  let role: "sender" | "receiver" = "sender";
  let sdp = "";
  let seq = 0;
  try {
    const body = (await req.json()) as { role?: unknown; sdp?: unknown; seq?: unknown };
    if (typeof body.sdp !== "string" || body.sdp === "") throw new Error();
    if (body.role === "receiver") role = "receiver";
    if (typeof body.seq !== "number" || !Number.isInteger(body.seq) || body.seq < 0) {
      throw new Error();
    }
    seq = body.seq;
    sdp = body.sdp;
  } catch {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const res = await addCandidate(code, role, sdp, seq);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, version: res.version });
}
