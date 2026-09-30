import { NextResponse } from "next/server";

export const runtime = "edge";

/** 返回是否配置了 Vercel OAuth 应用（client_id），前端据此决定是否显示"用 Vercel 登录"按钮 */
export function GET() {
  const clientId = process.env.VERCEL_CLIENT_ID;
  return NextResponse.json({
    configured: Boolean(clientId),
    clientId: clientId ?? null,
  });
}
