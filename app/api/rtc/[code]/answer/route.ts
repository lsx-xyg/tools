import { NextRequest, NextResponse } from "next/server";
import { setAnswer } from "@/lib/rtc";
import { isCode } from "@/lib/code";

type Params = { params: Promise<{ code: string }> };

/** POST /api/rtc/:code/answer — 接收方提交 SDP answer */
export async function POST(req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!isCode(code)) {
    return NextResponse.json({ error: "提取码格式不正确" }, { status: 400 });
  }
  let sdp = "";
  try {
    const body = (await req.json()) as { sdp?: unknown };
    if (typeof body.sdp !== "string") throw new Error();
    sdp = body.sdp;
  } catch {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const res = await setAnswer(code, sdp);
  if (!res.ok) {
    const status = res.reason === "expired" ? 410 : 404;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, version: res.version });
}
