"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { ToolHead } from "@/components/tool-head";
import { IconCheck, IconCopy, IconShield, IconTrash, IconZap } from "@/components/icons";

type TabId = "ws" | "sse";

interface LogEntry {
  id: number;
  time: string;
  dir: "recv" | "send" | "sys" | "err";
  text: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "ws", label: "WebSocket" },
  { id: "sse", label: "SSE" },
];

let logSeq = 0;
function makeLog(dir: LogEntry["dir"], text: string): LogEntry {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    id: ++logSeq,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`,
    dir,
    text,
  };
}

function DirBadge({ dir }: { dir: LogEntry["dir"] }) {
  const map = {
    recv: { label: "收", cls: "dir-recv" },
    send: { label: "发", cls: "dir-send" },
    sys: { label: "系", cls: "dir-sys" },
    err: { label: "错", cls: "dir-err" },
  } as const;
  const m = map[dir];
  return <span className={`ws-dir ${m.cls}`}>{m.label}</span>;
}

/* ============ WebSocket ============ */

function WsPanel() {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logsRef = useRef<LogEntry[]>([]);
  logsRef.current = logs;

  const push = useCallback((dir: LogEntry["dir"], text: string) => {
    const entry = makeLog(dir, text);
    setLogs((prev) => [...prev.slice(-199), entry]);
  }, []);

  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const connect = () => {
    const target = url.trim();
    if (!target) { push("err", "请输入 WebSocket 地址"); return; }
    // 混合内容检测
    if (typeof window !== "undefined" && window.location.protocol === "https:" && !/^wss:\/\//i.test(target) && !/^ws:\/\/localhost/i.test(target) && !/^ws:\/\/127\.0\.0\.1/i.test(target)) {
      push("err", "HTTPS 页面禁止连接非加密 ws://（localhost 除外），请改用 wss://");
    }
    setStatus("connecting");
    push("sys", `正在连接 ${target} ...`);
    let ws: WebSocket;
    try {
      ws = new WebSocket(target);
    } catch (e) {
      setStatus("error");
      push("err", `创建连接失败: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => { setStatus("open"); push("sys", "已连接"); };
    ws.onclose = (ev) => { setStatus("closed"); push("sys", `连接关闭 code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ""}`); };
    ws.onerror = () => { setStatus("error"); push("err", "连接错误"); };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        push("recv", ev.data);
      } else if (ev.data instanceof ArrayBuffer) {
        push("recv", `[二进制 ${ev.data.byteLength} 字节]`);
      } else {
        try {
          const blob = ev.data as Blob;
          push("recv", `[Blob ${blob.size} 字节]`);
        } catch {
          push("recv", "[未知数据类型]");
        }
      }
    };
  };

  const disconnect = () => {
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    setStatus("idle");
    push("sys", "已手动断开");
  };

  const send = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) { push("err", "未连接，无法发送"); return; }
    const text = msg;
    if (!text.trim()) { push("err", "消息不能为空"); return; }
    try {
      ws.send(text);
      push("send", text);
      setMsg("");
    } catch (e) {
      push("err", `发送失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const statusMeta: Record<string, { label: string; cls: string }> = {
    idle: { label: "未连接", cls: "st-idle" },
    connecting: { label: "连接中…", cls: "st-busy" },
    open: { label: "已连接", cls: "st-open" },
    closed: { label: "已断开", cls: "st-closed" },
    error: { label: "错误", cls: "st-err" },
  };

  const st = statusMeta[status];

  return (
    <div className="panel-swap">
      <div className="ws-url-row">
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws:// 或 wss:// 地址，如 wss://echo.websocket.org"
          spellCheck={false}
        />
        <button
          type="button"
          className={`btn ${status === "open" || status === "connecting" ? "btn-danger" : ""}`}
          onClick={status === "open" || status === "connecting" ? disconnect : connect}
        >
          <IconZap width={14} height={14} />
          {status === "open" || status === "connecting" ? "断开" : "连接"}
        </button>
      </div>

      <div className="ws-status-line">
        <span className={`ws-status-dot ${st.cls}`} />
        <span className="label">状态：{st.label}</span>
        <span className="count-hint">{logs.length} 条日志</span>
        <button
          type="button"
          className="ws-clear-btn"
          onClick={() => { setLogs([]); }}
          title="清空日志"
        >
          <IconTrash width={13} height={13} />
          清空
        </button>
      </div>

      <div className="ws-send-row">
        <input
          className="input"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="输入要发送的消息，Enter 发送"
          spellCheck={false}
        />
        <button type="button" className="btn" onClick={send}>
          <IconCheck width={14} height={14} />
          发送
        </button>
      </div>

      <div className="ws-log">
        {logs.length === 0 ? (
          <div className="qr-empty">连接后收发消息将在此显示时间线日志</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="ws-log-row">
              <span className="ws-time">{log.time}</span>
              <DirBadge dir={log.dir} />
              <span className={`ws-text ${log.dir === "err" ? "txt-err" : log.dir === "recv" ? "txt-recv" : log.dir === "send" ? "txt-send" : ""}`}>
                {log.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============ SSE ============ */

function SsePanel() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [headersText, setHeadersText] = useState("");
  const [body, setBody] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);

  const push = useCallback((dir: LogEntry["dir"], text: string) => {
    const entry = makeLog(dir, text);
    setLogs((prev) => [...prev.slice(-199), entry]);
  }, []);

  useEffect(() => {
    return () => { ctrlRef.current?.abort(); };
  }, []);

  const start = async () => {
    const target = url.trim();
    if (!target) { push("err", "请输入 SSE 地址"); return; }
    if (running) { push("err", "已有连接在运行，请先断开"); return; }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(target) && !/^http:\/\/localhost/i.test(target) && !/^http:\/\/127\.0\.0\.1/i.test(target)) {
      push("err", "HTTPS 页面禁止请求非加密 http://（localhost 除外），请改用 https://");
    }
    // 解析自定义 headers
    let headers: Record<string, string> = {};
    if (headersText.trim()) {
      try {
        const parsed = JSON.parse(headersText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("必须是 JSON 对象");
        headers = parsed as Record<string, string>;
      } catch (e) {
        push("err", `Headers 解析失败: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setRunning(true);
    push("sys", `连接 ${method} ${target}`);

    try {
      await fetchEventSource(target, {
        method,
        headers: { Accept: "text/event-stream", ...headers },
        body: method === "POST" ? body : undefined,
        signal: ctrl.signal,
        openWhenHidden: true,
        onopen: async (resp) => {
          if (resp.ok) {
            push("sys", `已连接 HTTP ${resp.status}`);
          } else {
            push("err", `连接失败 HTTP ${resp.status} ${resp.statusText}`);
          }
        },
        onmessage: (ev) => {
          const parts: string[] = [];
          if (ev.event && ev.event !== "message") parts.push(`event: ${ev.event}`);
          if (ev.id) parts.push(`id: ${ev.id}`);
          parts.push(ev.data);
          push("recv", parts.join(" ｜ "));
        },
        onclose: () => {
          setRunning(false);
          push("sys", "连接已关闭");
        },
        onerror: (err) => {
          if (ctrl.signal.aborted) return;
          setRunning(false);
          push("err", `错误: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        },
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        push("sys", "已手动断开");
      } else {
        push("err", `连接失败: ${e instanceof Error ? e.message : String(e)}`);
      }
      setRunning(false);
    }
  };

  const stop = () => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setRunning(false);
  };

  return (
    <div className="panel-swap">
      <div className="ws-url-row">
        <div className="seg seg-compact" role="group" aria-label="请求方法">
          {(["GET", "POST"] as const).map((m) => (
            <button key={m} type="button" data-active={method === m} onClick={() => setMethod(m)}>
              {m}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://echo.websocket.org/.sse"
          spellCheck={false}
        />
      </div>

      <div className="ws-status-line">
        <span className={`ws-status-dot ${running ? "st-open" : "st-idle"}`} />
        <span className="label">状态：{running ? "连接中" : "未连接"}</span>
        <span className="count-hint">{logs.length} 条日志</span>
        <button type="button" className="ws-clear-btn" onClick={() => { setLogs([]); }} title="清空日志">
          <IconTrash width={13} height={13} />
          清空
        </button>
      </div>

      <div className="ws-send-row" style={{ marginTop: 0 }}>
        <button
          type="button"
          className={`btn ${running ? "btn-danger" : ""}`}
          onClick={running ? stop : () => void start()}
        >
          <IconZap width={14} height={14} />
          {running ? "断开" : "连接"}
        </button>
      </div>

      <details className="hp-raw-collapse">
        <summary>自定义 Headers（JSON）与请求体</summary>
        <div className="sse-opts">
          <textarea
            className="input textarea"
            rows={3}
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            placeholder={'{"Authorization":"Bearer xxx","X-Custom":"1"}'}
            spellCheck={false}
          />
          {method === "POST" && (
            <textarea
              className="input textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="POST 请求体"
              spellCheck={false}
            />
          )}
        </div>
      </details>

      <div className="ws-log">
        {logs.length === 0 ? (
          <div className="qr-empty">连接后服务器推送的事件将在此按时间展示</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="ws-log-row">
              <span className="ws-time">{log.time}</span>
              <DirBadge dir={log.dir} />
              <span className={`ws-text ${log.dir === "err" ? "txt-err" : log.dir === "recv" ? "txt-recv" : log.dir === "send" ? "txt-send" : ""}`}>
                {log.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============ 页面 ============ */

export default function WsTestPage() {
  const [tab, setTab] = useState<TabId>("ws");

  return (
    <div className="fade-rise">
      <ToolHead
        title="WebSocket / SSE 测试"
        lede="WebSocket 收发消息 · SSE 流式订阅，实时时间线日志"
        chip={
          <span>
            <IconShield width={12} height={12} />
            浏览器本地连接 · 内容不上传
          </span>
        }
      />

      <div className="hp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
            type="button"
            className="hp-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <span className="label">{TABS.find((t) => t.id === tab)!.label} 测试</span>
          <span className="right count-hint">
            {tab === "ws" ? "原生 WebSocket" : "fetch-event-source"}
          </span>
        </div>
        <div className="panel-body">
          {tab === "ws" ? <WsPanel /> : <SsePanel />}
        </div>
      </section>

      <p className="count-hint ws-note">
        提示：HTTPS 页面下浏览器禁止连接非加密的 ws:// / http://（localhost 除外），
        测试本地服务请使用 wss:// / https:// 或本机 localhost。SSE 跨域需服务端开启 CORS。
      </p>
    </div>
  );
}
