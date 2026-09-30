import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/**
 * 接收前端传来的 code + code_verifier，用 client_secret 向 Vercel 换 access_token。
 * client_secret 只存在服务端，不暴露给前端。
 */
export async function POST(req: NextRequest) {
  let body: { code?: string; code_verifier?: string } = {};
  try {
    body = (await req.json()) as { code?: string; code_verifier?: string };
  } catch {
    return NextResponse.json({ error: "非法 JSON" }, { status: 400 });
  }

  const { code, code_verifier } = body;
  if (!code || !code_verifier) {
    return NextResponse.json({ error: "缺少 code 或 code_verifier" }, { status: 400 });
  }

  // 从 Cloudflare Workers env 读取 secret
  let clientId = process.env.VERCEL_CLIENT_ID;
  let clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const e = env as Record<string, string | undefined>;
      clientId = e.VERCEL_CLIENT_ID || clientId;
      clientSecret = e.VERCEL_CLIENT_SECRET || clientSecret;
    } catch {
      /* 回退 */
    }
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "服务端未配置 VERCEL_CLIENT_ID / VERCEL_CLIENT_SECRET" }, { status: 500 });
  }

  const redirectUri =
    process.env.VERCEL_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/vercel-oauth/callback`;

  try {
    const resp = await fetch("https://api.vercel.com/login/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Vercel 返回 [${resp.status}]：${text}` },
        { status: resp.status }
      );
    }

    const data = (await resp.json()) as { access_token?: string };
    if (!data.access_token) {
      return NextResponse.json({ error: "响应中缺少 access_token" }, { status: 502 });
    }

    return NextResponse.json({ token: data.access_token });
  } catch (e) {
    return NextResponse.json(
      { error: `请求异常：${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
