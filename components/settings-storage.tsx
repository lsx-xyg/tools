"use client";

import { useEffect, useState } from "react";
import { IconKey, IconServer } from "./icons";

type Backend = "kv" | "redis";

/**
 * 存储后端设置卡（管理员）：KV / Redis 切换 + 密码保护。
 * 密码：首次在网页设置（SHA-256 存 KV），也可用环境变量 STORAGE_SWITCH_PASSWORD 直接配置。
 */
export function SettingsStorage() {
  const [backend, setBackend] = useState<Backend>("kv");
  const [hasPw, setHasPw] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pw, setPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    fetch("/api/settings/storage")
      .then((r) => r.json())
      .then((data: { backend: Backend; hasPassword: boolean }) => {
        if (!on) return;
        setBackend(data.backend);
        setHasPw(data.hasPassword);
        setLoaded(true);
      })
      .catch(() => {
        if (on) setErr("读取配置失败");
      });
    return () => {
      on = false;
    };
  }, []);

  async function post(body: Record<string, unknown>): Promise<string | null> {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "操作失败");
        return null;
      }
      return "ok";
    } catch {
      setErr("网络错误，请重试");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function doSwitch(target: Backend) {
    if (target === backend) return;
    if (!pw) {
      setErr("请输入切换密码");
      return;
    }
    const ok = await post({ action: "switch", backend: target, password: pw });
    if (ok) {
      setBackend(target);
      setPw("");
      setMsg(target === "redis" ? "已切换到 Redis 后端" : "已切换到 KV 后端");
    }
  }

  async function doPassword() {
    if (newPw.length < 6) {
      setErr("密码至少 6 位");
      return;
    }
    const body = hasPw
      ? { action: "change-password", oldPassword: pw, password: newPw }
      : { action: "set-password", password: newPw };
    const ok = await post(body);
    if (ok) {
      setHasPw(true);
      setPw("");
      setNewPw("");
      setMsg(hasPw ? "密码已修改" : "切换密码已设置");
    }
  }

  return (
    <section className="panel settings-panel fade-rise" aria-label="存储后端设置">
      <div className="panel-title">
        <span className="label">
          <span className={`lamp ${backend === "redis" ? "ok" : ""}`} aria-hidden="true" />
          存储后端 · 管理员
        </span>
      </div>

      <div className="settings-grid">
        <div className="settings-backend">
          <div className={`backend-pill ${backend === "kv" ? "active" : ""}`}>
            <IconServer width={15} height={15} />
            KV（Cloudflare）
            {backend === "kv" && <span className="tag-now">使用中</span>}
          </div>
          <div className={`backend-pill ${backend === "redis" ? "active" : ""}`}>
            <IconServer width={15} height={15} />
            Redis（Upstash）
            {backend === "redis" && <span className="tag-now">使用中</span>}
          </div>
          <p className="count-hint">
            Redis 需在部署配置 REDIS_URL / REDIS_TOKEN（免费 Workers 走 HTTPS REST，免 TCP 出站）
          </p>
        </div>

        <div className="settings-actions">
          <div className="input-row">
            <input
              type="password"
              className="input"
              placeholder={hasPw ? "切换密码" : "先设置切换密码（≥6 位）"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
            <button
              className="btn btn-ghost"
              disabled={busy || backend === "redis"}
              onClick={() => void doSwitch("redis")}
              type="button"
            >
              切换到 Redis
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy || backend === "kv"}
              onClick={() => void doSwitch("kv")}
              type="button"
            >
              切回 KV
            </button>
          </div>
          <div className="input-row" style={{ marginTop: 10 }}>
            <input
              type="password"
              className="input"
              placeholder={hasPw ? "新密码（修改）" : "新密码"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
            <button className="btn btn-quiet" disabled={busy} onClick={() => void doPassword()} type="button">
              <IconKey width={14} height={14} />
              {hasPw ? "修改密码" : "设置密码"}
            </button>
          </div>
          {msg && <p className="count-hint" style={{ color: "var(--ok)" }}>{msg}</p>}
          {err && <p className="count-hint warn">{err}</p>}
          {!loaded && <p className="count-hint">读取配置中…</p>}
        </div>
      </div>
    </section>
  );
}
