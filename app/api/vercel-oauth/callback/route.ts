import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Vercel OAuth 回调：
 * 由于 PKCE 的 code_verifier 存在浏览器 sessionStorage 里，服务端拿不到，
 * 所以这里返回一个极简 HTML 页面，由前端 JS 读取 code + code_verifier，
 * POST 到 /api/vercel-oauth/exchange 换 token，成功后存 sessionStorage 并跳转。
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDesc = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return renderError(`授权失败：${errorDesc || error}`);
  }
  if (!code) {
    return renderError("缺少 authorization code");
  }

  // 前端 JS：从 URL 取 code，从 sessionStorage 取 code_verifier，POST 到 exchange 端点
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在完成 Vercel 登录…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f1e8;color:#23201a;}.card{text-align:center;}.spinner{width:32px;height:32px;border:3px solid #e5e0d6;border-top-color:#c2410c;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px;}@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body><div class="card"><div class="spinner"></div><p id="msg">正在换取 Token…</p></div>
<script>
(function(){
  var msg = document.getElementById('msg');
  var code = ${JSON.stringify(code)};
  var verifier = '';
  try { verifier = sessionStorage.getItem('vercel_pkce_verifier') || ''; } catch(e) {}
  if (!verifier) {
    msg.textContent = '错误：找不到 PKCE verifier，请重新发起登录';
    setTimeout(function(){ location.href = '/tools/vercel-clean'; }, 2000);
    return;
  }
  fetch('/api/vercel-oauth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code, code_verifier: verifier })
  }).then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if (res.ok && res.data.token) {
        try {
          sessionStorage.setItem('vercel_token', res.data.token);
          sessionStorage.removeItem('vercel_pkce_verifier');
        } catch(e) {}
        location.href = '/tools/vercel-clean';
      } else {
        msg.textContent = '换取 Token 失败：' + (res.data.error || res.data.detail || '未知错误');
      }
    })
    .catch(function(e){
      msg.textContent = '网络错误：' + e.message;
    });
})();
</script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderError(msg: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vercel 登录失败</title></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f1e8;"><div style="background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:480px;"><h2 style="margin:0 0 12px;color:#c0392b;">Vercel 登录失败</h2><p style="margin:0;color:#555;line-height:1.6;">${msg}</p><p style="margin:16px 0 0;"><a href="/tools/vercel-clean" style="color:#0F4C81;text-decoration:none;">← 返回工具箱</a></p></div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
