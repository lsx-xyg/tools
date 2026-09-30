"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolHead } from "@/components/tool-head";
import { IconCloud, IconTrash, IconRefresh, IconCheck, IconX, IconExternal, IconEye, IconEyeOff } from "@/components/icons";

/* ============ 常量 ============ */
const BASE_API_URL = "https://api.vercel.com";
const DEFAULT_KEEP_LATEST = 3;
const DEFAULT_CONCURRENCY = 8;
const PAGE_SIZE = 100;

/* ============ 类型 ============ */
interface VercelProject {
  id: string;
  name: string;
}

interface VercelDeployment {
  uid: string;
  url?: string;
  created?: number;
  state?: string;
}

type LogLevel = "info" | "success" | "error" | "warn" | "system";

interface LogEntry {
  id: number;
  text: string;
  level: LogLevel;
  time?: string;
  indent?: number;
}

/* ============ API 封装 ============ */
function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getAllProjects(token: string): Promise<VercelProject[]> {
  const projects: VercelProject[] = [];
  let until: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (until) params.set("until", until);

    const resp = await fetch(`${BASE_API_URL}/v9/projects?${params}`, {
      headers: headers(token),
    });
    if (resp.status === 403) throw new Error("Token 无效或权限不足，请检查 Token 是否正确。");
    if (!resp.ok) throw new Error(`获取项目失败 [${resp.status}]`);

    const data = await resp.json();
    for (const p of data.projects || []) {
      projects.push({ id: p.id, name: p.name });
    }

    const next = data.pagination?.next;
    if (!next) break;
    until = next;
  }
  return projects;
}

async function getDeploymentsForProject(
  token: string,
  projectId: string
): Promise<VercelDeployment[]> {
  const deps: VercelDeployment[] = [];
  let until: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      projectId,
    });
    if (until) params.set("until", until);

    const resp = await fetch(`${BASE_API_URL}/v7/deployments?${params}`, {
      headers: headers(token),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    deps.push(...(data.deployments || []));

    const next = data.pagination?.next;
    if (!next) break;
    until = next;
  }
  return deps;
}

async function deleteDeployment(
  token: string,
  dep: VercelDeployment
): Promise<{ ok: boolean; url: string; err?: string }> {
  const depUrl = dep.url || dep.uid;
  try {
    const resp = await fetch(`${BASE_API_URL}/v13/deployments/${dep.uid}`, {
      method: "DELETE",
      headers: headers(token),
    });
    if (resp.status === 200) return { ok: true, url: depUrl };
    const text = await resp.text();
    return { ok: false, url: depUrl, err: `[${resp.status}] ${text}` };
  } catch (e) {
    return { ok: false, url: depUrl, err: `请求异常: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* 并发池控制 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

/* ============ 页面组件 ============ */
export default function VercelCleanPage() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [selectedProject, setSelectedProject] = useState(""); // "" = 所有项目
  const [fetchingProjects, setFetchingProjects] = useState(false);

  const [keepLatest, setKeepLatest] = useState<number | "">(DEFAULT_KEEP_LATEST);
  const [concurrency, setConcurrency] = useState<number | "">(DEFAULT_CONCURRENCY);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [logFullscreen, setLogFullscreen] = useState(false);

  /* 日志自动滚动到底部 */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  const addLog = useCallback((text: string, level: LogLevel = "info", indent = 0) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [...prev, { id: ++logIdRef.current, text, level, time, indent }]);
  }, []);

  const clearLogs = () => setLogs([]);

  /* 获取项目列表 */
  const fetchProjects = async () => {
    if (!token.trim()) {
      addLog("请先填写 Vercel Token", "error");
      return;
    }
    setFetchingProjects(true);
    setProjects([]);
    setSelectedProject("");
    addLog("正在拉取项目列表…", "system");
    try {
      const list = await getAllProjects(token.trim());
      setProjects(list);
      addLog(`成功获取 ${list.length} 个项目。`, "success");
    } catch (e) {
      addLog(`获取项目失败：${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setFetchingProjects(false);
    }
  };

  /* 开始清理 */
  const runCleanup = async () => {
    if (!token.trim()) {
      addLog("请先提供 Vercel Token", "error");
      return;
    }
    if (running) return;

    setRunning(true);
    clearLogs();
    const t = token.trim();
    const keep = Math.max(0, Number(keepLatest) || DEFAULT_KEEP_LATEST);
    const conc = Math.max(1, Math.min(50, Number(concurrency) || DEFAULT_CONCURRENCY));

    addLog("=".repeat(50), "system");
    addLog(`开始清理（每个项目独立保留最新 ${keep} 个）`, "system");
    addLog("=".repeat(50), "system");

    try {
      // 1. 确定目标项目
      let targetProjects: VercelProject[];
      if (!selectedProject) {
        addLog("正在拉取所有项目…", "system");
        targetProjects = await getAllProjects(t);
        addLog(`共 ${targetProjects.length} 个项目。`, "info");
      } else {
        addLog("正在拉取项目列表以定位目标…", "system");
        const all = await getAllProjects(t);
        targetProjects = all.filter((p) => p.name === selectedProject);
        if (targetProjects.length === 0) {
          addLog(`错误：找不到项目 '${selectedProject}'`, "error");
          setRunning(false);
          return;
        }
        addLog(`已锁定项目 '${selectedProject}'。`, "info");
      }

      if (targetProjects.length === 0) {
        addLog("没有需要处理的项目。", "warn");
        setRunning(false);
        return;
      }

      // 2. 逐个项目拉部署，计算保留/删除
      const toDelete: { project: string; dep: VercelDeployment }[] = [];
      let totalKeep = 0;

      for (let i = 0; i < targetProjects.length; i++) {
        const { id, name } = targetProjects[i];
        addLog(`[${i + 1}/${targetProjects.length}] 项目 [${name}] 正在拉取部署…`, "system");
        let deps: VercelDeployment[];
        try {
          deps = await getDeploymentsForProject(t, id);
        } catch (e) {
          addLog(`拉取失败，跳过：${e instanceof Error ? e.message : String(e)}`, "error", 1);
          continue;
        }

        if (deps.length === 0) {
          addLog("该项目没有部署，跳过。", "warn", 1);
          continue;
        }

        const sorted = [...deps].sort(
          (a, b) => (b.created || 0) - (a.created || 0)
        );
        const keepList = sorted.slice(0, keep);
        const deleteList = sorted.slice(keep);
        totalKeep += keepList.length;

        addLog(`共 ${sorted.length} 个部署，保留 ${keepList.length} 个，待删 ${deleteList.length} 个。`, "info", 1);

        for (const dep of keepList) {
          const ts = dep.created
            ? new Date(dep.created).toLocaleString("zh-CN", { hour12: false })
            : "未知";
          addLog(`[保留] ${dep.url || dep.uid}  (${ts})`, "info", 2);
        }
        for (const dep of deleteList) {
          toDelete.push({ project: name, dep });
        }
      }

      addLog(`汇总：保留 ${totalKeep} 个，待删除 ${toDelete.length} 个。`, "system");

      if (toDelete.length === 0) {
        addLog("没有需要删除的部署。", "warn");
        setRunning(false);
        return;
      }

      addLog(`开始删除（并发 ${conc}）…\n`, "system");

      let successCount = 0;
      let failCount = 0;
      const failures: { project: string; url: string; err: string }[] = [];

      await runWithConcurrency(toDelete, conc, async ({ project, dep }, idx) => {
        const result = await deleteDeployment(t, dep);
        if (result.ok) {
          successCount++;
          addLog(`[${idx + 1}/${toDelete.length}] ✓ [${project}] 已删除 ${result.url}`, "success", 1);
        } else {
          failCount++;
          failures.push({ project, url: result.url, err: result.err || "未知错误" });
          addLog(`[${idx + 1}/${toDelete.length}] ✗ [${project}] 删除失败 ${result.url} -> ${result.err}`, "error", 1);
        }
      });

      addLog(`\n完成：成功 ${successCount} 个，失败 ${failCount} 个`, "system");
      if (failures.length > 0) {
        addLog("\n失败详情：", "error");
        for (const f of failures) {
          addLog(`  [${f.project}] ${f.url}: ${f.err}`, "error");
        }
      }
    } catch (e) {
      addLog(`\n发生异常：${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRunning(false);
    }
  };

  /* 日志面板（非全屏/全屏共用，全屏时通过 Portal 渲染到 body） */
  const logPanel = (
    <div className={`panel vc-log-panel ${logFullscreen ? "vc-log-fullscreen" : ""}`}>
      <div className="panel-head">
        <span className="label">运行日志</span>
        <span className="right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="count-hint">{logs.length} 条</span>
          <button
            type="button"
            className="vc-icon-btn"
            onClick={() => setLogFullscreen(!logFullscreen)}
            title={logFullscreen ? "退出全屏" : "全屏查看"}
            style={{ width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {logFullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
            )}
          </button>
        </span>
      </div>
      <div className="panel-body">
        <div className="vc-log">
          {logs.length === 0 ? (
            <div className="vc-log-empty">配置完成后点击「开始清理」，日志将在此实时输出。</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`vc-log-line vc-log-${log.level} vc-log-indent-${log.indent || 0}`}>
                {log.time && <span className="vc-log-time">{log.time}</span>}
                <span className="vc-log-text">{log.text}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-rise">
      <ToolHead
        title="Vercel 部署清理"
        lede="批量删除旧部署 · 每个项目保留最新 N 个 · 实时日志"
        chip={
          <span>
            <IconCloud width={12} height={12} />
            Token 仅存内存 · 关闭即清除
          </span>
        }
      />

      <div className="vc-layout">
        {/* ===== 配置区 ===== */}
        <div className="panel">
          <div className="panel-head">
            <span className="label">配置</span>
            <span className="right count-hint">Token 仅存内存</span>
          </div>
          <div className="panel-body">
            {/* Token 输入 */}
            <div className="vc-field">
              <label className="vc-label">Vercel Token</label>
              <div className="vc-token-row">
                <input
                  type={showToken ? "text" : "password"}
                  className="input vc-token-input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="粘贴 Vercel Access Token"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-ghost vc-icon-btn"
                  onClick={() => setShowToken((s) => !s)}
                  title={showToken ? "隐藏" : "显示"}
                >
                  {showToken ? <IconEyeOff /> : <IconEye />}
                </button>
                {token && (
                  <button
                    type="button"
                    className="btn btn-ghost vc-icon-btn"
                    onClick={() => setToken("")}
                    title="清除 Token"
                  >
                    <IconX />
                  </button>
                )}
              </div>
              <div className="vc-token-actions">
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vc-link"
                >
                  如何获取 Token <IconExternal />
                </a>
              </div>
            </div>

            {/* 项目选择 */}
            <div className="vc-field">
              <label className="vc-label">选择项目</label>
              <div className="vc-project-row">
                <select
                  className="input vc-project-select"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={projects.length === 0 || fetchingProjects}
                >
                  <option value="">[所有项目]</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary vc-match-height"
                  onClick={fetchProjects}
                  disabled={!token.trim() || fetchingProjects || running}
                >
                  <IconRefresh className={fetchingProjects ? "spin" : ""} />
                  {fetchingProjects ? "获取中…" : "获取项目列表"}
                </button>
              </div>
            </div>

            {/* 保留数 + 并发数 */}
            <div className="vc-config-row">
              <div className="vc-field">
                <label className="vc-label">每个项目保留最新部署数</label>
                <input
                  type="number"
                  className="input"
                  value={keepLatest}
                  onChange={(e) => {
                    const v = e.target.value;
                    setKeepLatest(v === "" ? "" : Math.max(0, parseInt(v) || 0));
                  }}
                  min={0}
                  disabled={running}
                />
              </div>
              <div className="vc-field">
                <label className="vc-label">并发删除数</label>
                <input
                  type="number"
                  className="input"
                  value={concurrency}
                  onChange={(e) => {
                    const v = e.target.value;
                    setConcurrency(v === "" ? "" : Math.max(1, Math.min(50, parseInt(v) || 1)));
                  }}
                  min={1}
                  max={50}
                  disabled={running}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="vc-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={runCleanup}
                disabled={!token.trim() || running}
              >
                <IconTrash />
                {running ? "清理中…" : "开始清理"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearLogs}
                disabled={logs.length === 0 || running}
              >
                清空日志
              </button>
            </div>
          </div>
        </div>

        {/* ===== 日志区（非全屏） ===== */}
        {!logFullscreen && logPanel}
      </div>

      {/* 全屏日志：用 Portal 渲染到 body，避免被祖先 transform 限制遮罩范围 */}
      {logFullscreen && typeof document !== "undefined" && createPortal(
        <>
          <div className="vc-log-overlay" onClick={() => setLogFullscreen(false)} />
          {logPanel}
        </>,
        document.body
      )}

      <div className="vc-note">
        <strong>安全说明：</strong>Token 仅保存在当前页面的 React state（内存）中，不写入 localStorage / Cookie，
        刷新或关闭标签页即清除。
        所有 API 请求直接从浏览器发往 Vercel 官方 API，不经过本工具的服务器中转。
      </div>
    </div>
  );
}
