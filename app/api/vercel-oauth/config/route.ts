import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/** 返回是否配置了 Vercel OAuth 应用（client_id），前端据此决定是否显示"用 Vercel 登录"按钮 */
export async function GET() {
  let clientId: string | undefined;

  // 生产：从 Cloudflare Workers env 读取 secret
  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      clientId = (env as Record<string, string | undefined>).VERCEL_CLIENT_ID;
    } catch {
      /* getCloudflareContext 不可用时回退 */
    }
  }

  // 本地开发 / 回退：读 process.env
  if (!clientId) {
    clientId = process.env.VERCEL_CLIENT_ID;
  }

  return NextResponse.json({
    configured: Boolean(clientId),
    clientId: clientId ?? null,
  });
}
