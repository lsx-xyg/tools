/**
 * 全站密码保护入口（自定义 Cloudflare Worker）。
 * 构建时由 opennextjs-cloudflare 生成 .open-next/worker.js，本文件在其外层包装认证：
 * - 未验证（无有效 site_auth Cookie）→ 一律返回极简密码页（含 /api/*）
 * - POST /api/auth 校验密码（env.SITE_PASSWORD）→ 写入 30 天 HttpOnly Cookie
 * - 已验证 → 转发给 OpenNext worker 正常处理
 */
// @ts-expect-error 构建产物：opennextjs-cloudflare build 后生成
import opennextWorker from "./.open-next/worker.js";
import { authSetCookie, checkPassword, hasAuth } from "./lib/site-auth";

interface AuthEnv {
  SITE_PASSWORD?: string;
  ASSETS?: unknown;
  [key: string]: unknown;
}

interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

const LOGIN_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>工具箱 · 访问验证</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f3ef;color:#23201a;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{width:min(340px,92vw);background:#fff;border:1px solid #e5e0d6;border-radius:16px;padding:32px 28px;box-shadow:0 10px 40px rgba(0,0,0,.06)}
.logo{font-size:13px;letter-spacing:.14em;color:#a89680;margin-bottom:8px}
h1{font-size:20px;font-weight:600;margin-bottom:22px}
input{width:100%;padding:12px 14px;border:1px solid #ddd6c8;border-radius:10px;font-size:15px;background:#faf9f6;outline:none;transition:border-color .2s}
input:focus{border-color:#c2410c}
button{width:100%;margin-top:14px;padding:12px;border:none;border-radius:10px;background:#c2410c;color:#fff;font-size:15px;font-weight:500;cursor:pointer;transition:opacity .2s}
button:hover{opacity:.9}
button:disabled{opacity:.5;cursor:default}
.err{margin-top:12px;font-size:13px;color:#b3261e;min-height:18px}
.foot{margin-top:16px;font-size:11.5px;color:#a89680;text-align:center}
</style>
</head>
<body>
<div class="card">
  <div class="logo">TOOLBOX</div>
  <h1>请输入访问密码</h1>
  <form id="f">
    <input id="p" type="password" placeholder="访问密码" autocomplete="current-password" autofocus>
    <button id="b" type="submit">进入工具箱</button>
  </form>
  <p class="err" id="e"></p>
  <p class="foot">数据 24 小时后自动销毁</p>
</div>
<script>
var f=document.getElementById('f'),p=document.getElementById('p'),e=document.getElementById('e'),b=document.getElementById('b'),lock=false;
f.addEventListener('submit',function(ev){ev.preventDefault();if(lock)return;var v=p.value;if(!v){e.textContent='请输入密码';return;}lock=true;b.disabled=true;e.textContent='';
fetch('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:v})}).then(function(r){if(r.ok){location.reload();}else{e.textContent='密码错误，请重试';lock=false;b.disabled=false;p.select();}}).catch(function(){e.textContent='网络错误，请重试';lock=false;b.disabled=false;});});
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: AuthEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 认证接口（不经过 Next 应用）
    if (url.pathname === "/api/auth") {
      if (request.method === "POST") {
        let body: { password?: string } = {};
        try {
          body = (await request.json()) as { password?: string };
        } catch {
          /* 忽略非法 JSON */
        }
        if (!checkPassword(body.password, env.SITE_PASSWORD)) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": authSetCookie(url.protocol === "https:"),
          },
        });
      }
      // GET：供前端探测登录状态
      return new Response(JSON.stringify({ authed: hasAuth(request.headers.get("cookie")) }), {
        headers: { "content-type": "application/json" },
      });
    }

    // 已认证 → 正常处理
    if (hasAuth(request.headers.get("cookie"))) {
      return opennextWorker.fetch(request, env, ctx);
    }

    // 未认证 → 密码页（所有路径、所有静态资源、所有 API）
    return new Response(LOGIN_PAGE, {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
