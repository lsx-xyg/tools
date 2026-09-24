import { NextRequest, NextResponse } from "next/server";
import { addCandidate } from "@/lib/rtc";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string }> };

/** POST /api/rtc/:code/candidate — 双方提交 ICE candidate */
export async function POST(req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  let role: "sender" | "receiver" = "sender";
  let sdp = "";
  try {
    const body = (await req.json()) as { role?: unknown; sdp?: unknown };
    if (typeof body.sdp !== "string") throw new Error();
    if (body.role === "receiver") role = "receiver";
    sdp = body.sdp;
  } catch {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const res = await addCandidate(code, role, sdp);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, version: res.room.version });
}
