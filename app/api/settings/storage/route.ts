import { NextRequest, NextResponse } from "next/server";
import { getBackend, hasPassword, setBackend, setPassword, verifyPassword } from "@/lib/settings";

/**
 * GET /api/settings/storage — 当前后端与密码状态
 * POST /api/settings/storage — 切换后端 / 设置密码
 *   { action: "switch", backend: "kv"|"redis", password }
 *   { action: "set-password", password }（首次设置；已有密码时需旧密码）
 *   { action: "change-password", oldPassword, password }
 */
export async function GET() {
  const [backend, pw] = await Promise.all([getBackend(), hasPassword()]);
  return NextResponse.json({ backend, hasPassword: pw });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;

  if (action === "set-password") {
    const pw = typeof body.password === "string" ? body.password : "";
    if (pw.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }
    if (await hasPassword()) {
      return NextResponse.json({ error: "已设置过密码，请使用修改密码" }, { status: 400 });
    }
    await setPassword(pw);
    return NextResponse.json({ ok: true });
  }

  if (action === "change-password") {
    const oldPw = typeof body.oldPassword === "string" ? body.oldPassword : "";
    const pw = typeof body.password === "string" ? body.password : "";
    if (!(await verifyPassword(oldPw))) {
      return NextResponse.json({ error: "旧密码不正确" }, { status: 401 });
    }
    if (pw.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }
    await setPassword(pw);
    return NextResponse.json({ ok: true });
  }

  if (action === "switch") {
    const backend = body.backend === "redis" ? "redis" : body.backend === "kv" ? "kv" : null;
    if (!backend) {
      return NextResponse.json({ error: "后端只能是 kv 或 redis" }, { status: 400 });
    }
    const pw = typeof body.password === "string" ? body.password : "";
    if (!(await verifyPassword(pw))) {
      return NextResponse.json({ error: "密码不正确" }, { status: 401 });
    }
    await setBackend(backend);
    return NextResponse.json({ ok: true, backend });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
