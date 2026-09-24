import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/rtc";
import { genUniqueCode } from "@/lib/code";
import { getStorage } from "@/lib/kv";

/**
 * POST /api/rtc — 创建在线 P2P 信令房间，返回 6 位提取码。
 * 房间只存 SDP/ICE 信令，15 分钟内未连接自动过期。
 */
export async function POST(_req: NextRequest) {  // eslint-disable-line @typescript-eslint/no-unused-vars -- Next 路由签名
  const { kv } = await getStorage();
  const code = await genUniqueCode(async (c) => (await kv.get(`rtc:${c}:meta`)) !== null);
  await createRoom(code);
  return NextResponse.json({ code, mode: "rtc" });
}
