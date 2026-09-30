import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel OAuth 回调：用 authorization code 换 access_token，
 * 然后通过 sessionStorage 临时传递给前端页面（不进 URL、不进 localStorage）。
 * 前端读取后立即删除 sessionStorage，token 仅存 React state，关闭标签页即清除。
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDesc = req.nextUrl.searchParams.get("error_description");

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  const redirectUri =
    process.env.VERCEL_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/vercel-oauth/callback`;

  if (error) {
    return renderError(`授权失败：${errorDesc || error}`);
  }
  if (!code) {
    return renderError("缺少 authorization code");
  }
  if (!clientId || !clientSecret) {
    return renderError("服务端未配置 VERCEL_CLIENT_ID / VERCEL_CLIENT_SECRET");
  }

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
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return renderError(`换取 Token 失败 [${resp.status}]：${text}`);
    }

    const data = (await resp.json()) as { access_token?: string };
    const token = data.access_token;
    if (!token) {
      return renderError("响应中缺少 access_token");
    }

    // 通过 sessionStorage 传递：渲染一个极简页面，写入后立即跳转
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在返回工具箱…</title></head><body><script>
try { sessionStorage.setItem("vercel_token", ${JSON.stringify(token)}); } catch(e) {}
location.href = "/tools/vercel-clean";
</script></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return renderError(`请求异常：${e instanceof Error ? e.message : String(e)}`);
  }
}

function renderError(msg: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vercel 登录失败</title></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f1e8;"><div style="background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:480px;"><h2 style="margin:0 0 12px;color:#c0392b;">Vercel 登录失败</h2><p style="margin:0;color:#555;line-height:1.6;">${msg}</p><p style="margin:16px 0 0;"><a href="/tools/vercel-clean" style="color:#0F4C81;text-decoration:none;">← 返回工具箱</a></p></div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
