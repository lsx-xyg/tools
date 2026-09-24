"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { createPortal } from "react-dom";
import { IconDatabase, IconKey, IconX } from "./icons";

const noopSubscribe = () => () => {};

type Backend = "kv" | "redis";

/**
 * 存储后端切换（隐藏入口）：
 * - 键盘连敲 "tools"（页面空白处，输入框内不触发）→ 右下角浮现小按钮
 * - 点按钮 → 弹出密码弹窗，校验后切换 KV / Redis 或设置修改密码
 */
export function StorageSwitch() {
  const [showBtn, setShowBtn] = useState(false);
  const [open, setOpen] = useState(false);
  const [backend, setBackend] = useState<Backend>("kv");
  const [hasPw, setHasPw] = useState(false);
  const [pw, setPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // SSR 阶段没有 document，portal 只渲染在客户端
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // 键盘连敲 "tools" 呼出小按钮（忽略表单输入）
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === "tools") {
        buf = "";
        setShowBtn(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openModal() {
    setOpen(true);
    setMsg("");
    setErr("");
    void fetch("/api/settings/storage")
      .then((r) => r.json())
      .then((d: { backend: Backend; hasPassword: boolean }) => {
        setBackend(d.backend);
        setHasPw(d.hasPassword);
      })
      .catch(() => setErr("读取配置失败"));
  }

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !d.ok) {
        setErr(d.error ?? "操作失败");
        return false;
      }
      return true;
    } catch {
      setErr("网络错误，请重试");
      return false;
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
      setMsg(target === "redis" ? "已切换到 Redis" : "已切换到 KV");
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

  // Portal 到 body：避免被页面的 transform 容器（.fade-rise 动画）破坏 fixed 全屏定位
  const node = (
    <>
      {showBtn && (
        <button
          className="storage-fab"
          onClick={openModal}
          title="存储后端"
          aria-label="存储后端切换"
          type="button"
        >
          <IconDatabase width={16} height={16} />
        </button>
      )}

      {open && (
        <div className="modal-scrim" onClick={() => setOpen(false)}>
          <div className="modal modal-pop" role="dialog" aria-modal="true" aria-label="存储后端切换" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="label">
                <span className={`lamp ${backend === "redis" ? "ok" : ""}`} aria-hidden="true" />
                存储后端
              </span>
              <button className="btn btn-quiet btn-icon" onClick={() => setOpen(false)} type="button" aria-label="关闭">
                <IconX width={14} height={14} />
              </button>
            </div>

            <div className="modal-backends">
              <span className={`modal-backend ${backend === "kv" ? "on" : ""}`}>
                KV（Cloudflare）
                {backend === "kv" && <em>使用中</em>}
              </span>
              <span className={`modal-backend ${backend === "redis" ? "on" : ""}`}>
                Redis（Upstash）
                {backend === "redis" && <em>使用中</em>}
              </span>
            </div>

            <div className="input-row">
              <input
                type="password"
                className="input"
                placeholder={hasPw ? "切换密码" : "切换密码（先设置）"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
              />
              <button
                className="btn btn-primary"
                disabled={busy || backend === "redis"}
                onClick={() => void doSwitch("redis")}
                type="button"
              >
                切到 Redis
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
                placeholder={hasPw ? "新密码（改密码）" : "新密码"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              <button className="btn btn-quiet" disabled={busy} onClick={() => void doPassword()} type="button">
                <IconKey width={14} height={14} />
                {hasPw ? "改密码" : "设密码"}
              </button>
            </div>

            <p className="count-hint" style={{ marginTop: 10 }}>
              Redis 需部署配置 REDIS_URL / REDIS_TOKEN（Upstash REST）
            </p>
            {msg && <p className="count-hint" style={{ color: "var(--ok)", marginTop: 6 }}>{msg}</p>}
            {err && <p className="count-hint warn" style={{ marginTop: 6 }}>{err}</p>}
          </div>
        </div>
      )}
    </>
  );

  if (!isClient) return null;
  return createPortal(node, document.body);
}
