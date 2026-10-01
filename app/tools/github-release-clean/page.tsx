"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolHead } from "@/components/tool-head";
import { IconGithub, IconTrash, IconRefresh, IconCheck, IconX, IconExternal, IconEye, IconEyeOff } from "@/components/icons";

/* ============ 常量 ============ */
const BASE_API_URL = "https://api.github.com";
const DEFAULT_KEEP_LATEST = 3;
const DEFAULT_CONCURRENCY = 8;
const PAGE_SIZE = 100;

/* ============ 类型 ============ */
interface GithubRepo {
  full_name: string;
  name: string;
}

interface GithubRelease {
  id: number;
  tag_name?: string;
  name?: string;
  created_at?: string;
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
function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getAllRepos(token: string): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = [];
  let page = 1;
  while (true) {
    const url = `${BASE_API_URL}/user/repos?per_page=${PAGE_SIZE}&page=${page}&sort=updated`;
    const resp = await fetch(url, { headers: buildHeaders(token) });
    if (resp.status === 401) throw new Error("Token 无效，请检查是否正确。");
    if (resp.status === 403) throw new Error("Token 权限不足或触发限流。");
    if (!resp.ok) throw new Error(`[${resp.status}] ${await resp.text()}`);
    const data = (await resp.json()) as GithubRepo[];
    if (!data.length) break;
    repos.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return repos;
}

async function getReleasesForRepo(token: string, fullName: string): Promise<GithubRelease[]> {
  const all: GithubRelease[] = [];
  let page = 1;
  while (true) {
    const url = `${BASE_API_URL}/repos/${fullName}/releases?per_page=${PAGE_SIZE}&page=${page}`;
    const resp = await fetch(url, { headers: buildHeaders(token) });
    if (!resp.ok) throw new Error(`[${resp.status}]`);
    const data = (await resp.json()) as GithubRelease[];
    if (!data.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

async function deleteRelease(
  token: string,
  fullName: string,
  release: GithubRelease,
  deleteTag: boolean
): Promise<{ ok: boolean; label: string; err?: string }> {
  const label = `${release.tag_name || "(无 tag)"} (id=${release.id})`;
  const resp = await fetch(`${BASE_API_URL}/repos/${fullName}/releases/${release.id}`, {
    method: "DELETE",
    headers: buildHeaders(token),
  });
  if (!resp.ok && resp.status !== 204) {
    return { ok: false, label, err: `[${resp.status}] ${(await resp.text()).slice(0, 200)}` };
  }
  if (deleteTag && release.tag_name) {
    const tagResp = await fetch(`${BASE_API_URL}/repos/${fullName}/git/refs/tags/${encodeURIComponent(release.tag_name)}`, {
      method: "DELETE",
      headers: buildHeaders(token),
    });
    if (!tagResp.ok && tagResp.status !== 204 && tagResp.status !== 422) {
      return { ok: true, label, err: `(release 已删，但 tag 删除失败: [${tagResp.status}])` };
    }
  }
  return { ok: true, label };
}

/* 并发池 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>
): Promise<void> {
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (items.length) {
      const item = items.shift()!;
      await worker(item, 0);
    }
  });
  await Promise.all(runners);
}

/* ============ 页面组件 ============ */
export default function GithubReleaseCleanPage() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [fetchingRepos, setFetchingRepos] = useState(false);

  const [keepLatest, setKeepLatest] = useState<number | "">(DEFAULT_KEEP_LATEST);
  const [concurrency, setConcurrency] = useState<number | "">(DEFAULT_CONCURRENCY);
  const [deleteTag, setDeleteTag] = useState(true);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [logFullscreen, setLogFullscreen] = useState(false);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  const addLog = useCallback((text: string, level: LogLevel = "info", indent = 0) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [...prev, { id: ++logIdRef.current, text, level, time, indent }]);
  }, []);

  const clearLogs = () => setLogs([]);

  /* 获取仓库列表 */
  const fetchRepos = async () => {
    if (!token.trim()) {
      addLog("请先填写 GitHub Token", "error");
      return;
    }
    setFetchingRepos(true);
    addLog("正在拉取仓库列表…", "system");
    try {
      const list = await getAllRepos(token.trim());
      setRepos(list);
      addLog(`成功获取 ${list.length} 个仓库。`, "success");
    } catch (e) {
      addLog(`获取仓库失败：${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setFetchingRepos(false);
    }
  };

  /* 开始清理 */
  const runCleanup = async () => {
    if (!token.trim()) {
      addLog("请先填写 GitHub Token", "error");
      return;
    }
    setRunning(true);
    const t = token.trim();
    const keep = Math.max(0, Number(keepLatest) || DEFAULT_KEEP_LATEST);
    const conc = Math.max(1, Math.min(50, Number(concurrency) || DEFAULT_CONCURRENCY));
    const isAll = !selectedRepo;

    try {
      addLog(`开始清理（每个仓库独立保留最新 ${keep} 个 Release）`, "system");
      addLog(`同时删除 Git tag：${deleteTag ? "是" : "否"}`, "system");

      /* 1. 确定目标仓库 */
      let targetRepos: GithubRepo[];
      if (isAll) {
        addLog("正在拉取所有仓库…", "info");
        targetRepos = await getAllRepos(t);
        addLog(`共 ${targetRepos.length} 个仓库。`, "info", 1);
      } else {
        targetRepos = [{ full_name: selectedRepo, name: selectedRepo.split("/").pop() || selectedRepo }];
        addLog(`已锁定仓库 [${selectedRepo}]。`, "info");
      }

      if (!targetRepos.length) {
        addLog("没有需要处理的仓库。", "warn");
        return;
      }

      /* 2. 逐个仓库拉取 Release */
      const toDelete: { fullName: string; release: GithubRelease }[] = [];
      let totalKeep = 0;

      for (let i = 0; i < targetRepos.length; i++) {
        const { full_name } = targetRepos[i];
        addLog(`[${i + 1}/${targetRepos.length}] 仓库 [${full_name}] 正在拉取 Release…`, "system");
        let releases: GithubRelease[];
        try {
          releases = await getReleasesForRepo(t, full_name);
        } catch (e) {
          addLog(`拉取失败，跳过：${e instanceof Error ? e.message : String(e)}`, "error", 1);
          continue;
        }
        if (!releases.length) {
          addLog("该仓库没有 Release，跳过。", "warn", 1);
          continue;
        }
        const sorted = [...releases].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        const keepList = sorted.slice(0, keep);
        const deleteList = sorted.slice(keep);
        totalKeep += keepList.length;
        addLog(`共 ${sorted.length} 个 Release，保留 ${keepList.length} 个，待删 ${deleteList.length} 个。`, "info", 1);
        for (const rel of keepList) {
          const ts = rel.created_at ? rel.created_at.replace("T", " ").slice(0, 16) : "未知";
          addLog(`[保留] ${rel.tag_name || "(无 tag)"} (${rel.name || ""})  (${ts})`, "info", 2);
        }
        for (const rel of deleteList) {
          toDelete.push({ fullName: full_name, release: rel });
        }
      }

      addLog(`汇总：保留 ${totalKeep} 个，待删除 ${toDelete.length} 个。`, "system");

      if (!toDelete.length) {
        addLog("没有需要删除的 Release。", "warn");
        return;
      }

      addLog(`开始删除（并发 ${conc}）…`, "system");

      let successCount = 0;
      let failCount = 0;
      const failures: { fullName: string; label: string; err: string }[] = [];
      let idx = 0;

      await runWithConcurrency(toDelete, conc, async ({ fullName, release }) => {
        const i = ++idx;
        const result = await deleteRelease(t, fullName, release, deleteTag);
        if (result.ok && !result.err) {
          successCount++;
          addLog(`[${i}/${toDelete.length}] ✓ [${fullName}] 已删除 ${result.label}`, "success", 1);
        } else if (result.ok && result.err) {
          successCount++;
          addLog(`[${i}/${toDelete.length}] ⚠ [${fullName}] ${result.label} ${result.err}`, "warn", 1);
        } else {
          failCount++;
          failures.push({ fullName, label: result.label, err: result.err || "未知错误" });
          addLog(`[${i}/${toDelete.length}] ✗ [${fullName}] 删除失败 ${result.label} -> ${result.err}`, "error", 1);
        }
      });

      addLog(`完成：成功 ${successCount} 个，失败 ${failCount} 个。`, "system");
      if (failures.length) {
        addLog("失败详情：", "system");
        for (const f of failures) {
          addLog(`[${f.fullName}] ${f.label}: ${f.err}`, "error", 1);
        }
      }
    } catch (e) {
      addLog(`发生异常：${e instanceof Error ? e.message : String(e)}`, "error");
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
        title="GitHub Release 清理"
        lede="批量删除旧 Release · 每个仓库保留最新 N 个 · 可选删 Tag · 实时日志"
        chip={
          <span>
            <IconGithub width={12} height={12} />
            Token 仅存内存 · 关闭即清除
          </span>
        }
      />

      <div className="vc-layout">
        {/* ===== 配置面板 ===== */}
        <div className="panel">
          <div className="panel-head">
            <span className="label">配置</span>
            <span className="right subtle">Token 仅存内存</span>
          </div>
          <div className="panel-body">
            {/* Token 输入 */}
            <div className="vc-field">
              <label className="vc-label">GitHub Token</label>
              <div className="vc-token-row">
                <input
                  type={showToken ? "text" : "password"}
                  className="input vc-token-input"
                  placeholder="粘贴 GitHub Personal Access Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={running}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="vc-icon-btn"
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? "隐藏" : "显示"}
                >
                  {showToken ? <IconEyeOff /> : <IconEye />}
                </button>
                <button
                  type="button"
                  className="vc-icon-btn"
                  onClick={() => setToken("")}
                  title="清除"
                  disabled={running}
                >
                  <IconX />
                </button>
              </div>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="vc-link"
              >
                如何获取 Token <IconExternal />
              </a>
            </div>

            {/* 仓库选择 */}
            <div className="vc-field">
              <label className="vc-label">选择仓库</label>
              <div className="vc-project-row">
                <select
                  className="input vc-project-select"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  disabled={running}
                >
                  <option value="">[所有仓库]</option>
                  {repos.map((r) => (
                    <option key={r.full_name} value={r.full_name}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm vc-match-height"
                  onClick={fetchRepos}
                  disabled={!token.trim() || fetchingRepos || running}
                >
                  <IconRefresh /> {fetchingRepos ? "获取中…" : "获取仓库列表"}
                </button>
              </div>
            </div>

            {/* 保留数 + 并发数 */}
            <div className="vc-config-row">
              <div className="vc-field">
                <label className="vc-label">每个仓库保留最新 Release 数</label>
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

            {/* 删除 Tag 选项 */}
            <div className="vc-field">
              <label className="vc-checkbox-label">
                <input
                  type="checkbox"
                  checked={deleteTag}
                  onChange={(e) => setDeleteTag(e.target.checked)}
                  disabled={running}
                />
                <span>同时删除对应的 Git tag（危险操作，删除后不可恢复）</span>
              </label>
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

      {/* 全屏日志：用 Portal 渲染到 body */}
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
        所有 API 请求直接从浏览器发往 GitHub 官方 API，不经过本工具的服务器中转。
      </div>
    </div>
  );
}
