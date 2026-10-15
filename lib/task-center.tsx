"use client";

/* 全局任务中心：耗时任务（视频转换 / PDF 压缩等）提交到模块级 store，
   页面切换不中断，右下角悬浮按钮随时查看进度与完成结果。
   store 在模块级，跨页面共享；layout 挂载 TaskCenter 常驻。 */

import { useCallback, useSyncExternalStore } from "react";
import { useState } from "react";
import { IconCheck, IconDownload, IconLoader, IconTrash, IconX } from "@/components/icons";

export type TaskStatus = "running" | "done" | "error";

export interface Task {
  id: string;
  toolName: string;
  label: string;
  status: TaskStatus;
  progress: number; // 0-1
  log: string;
  resultUrl?: string;
  resultName?: string;
  error?: string;
  createdAt: number;
}

/* ---------- store ---------- */

let tasks: Task[] = [];
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getTasks(): Task[] {
  return tasks;
}

function getVersion(): number {
  return version;
}

let seq = 0;

export function createTask(toolName: string, label: string): string {
  const id = `task_${Date.now()}_${++seq}`;
  tasks = [{ id, toolName, label, status: "running", progress: 0, log: "", createdAt: Date.now() }, ...tasks];
  emit();
  return id;
}

export function updateTask(id: string, patch: Partial<Pick<Task, "progress" | "log">>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  emit();
}

export function completeTask(id: string, resultUrl: string, resultName: string) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: "done", progress: 1, resultUrl, resultName } : t));
  emit();
}

export function failTask(id: string, error: string) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: "error", error } : t));
  emit();
}

export function removeTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  emit();
}

export function clearFinished() {
  tasks = tasks.filter((t) => t.status === "running");
  emit();
}

/** 查询某工具当前是否有运行中任务 */
export function hasRunningTask(toolName: string): boolean {
  return tasks.some((t) => t.toolName === toolName && t.status === "running");
}

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks, getTasks);
}

/* ---------- 悬浮按钮 + 面板 ---------- */

export function TaskCenter() {
  const tasks = useTasks();
  const [open, setOpen] = useState(false);

  const running = tasks.filter((t) => t.status === "running").length;
  const finished = tasks.filter((t) => t.status !== "running").length;
  const badge = running > 0 ? running : finished;

  const onRemove = useCallback((id: string) => removeTask(id), []);
  const onClear = useCallback(() => clearFinished(), []);

  return (
    <>
      <button
        type="button"
        className="task-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`任务中心，${running} 个进行中`}
        title={running > 0 ? `${running} 个任务进行中` : "任务中心"}
      >
        <span className="task-fab-icon">{running > 0 ? <IconLoader width={16} height={16} className="spin" /> : <IconCheck width={16} height={16} />}</span>
        <span className="task-fab-badge">{badge}</span>
        <span className="task-fab-text">任务</span>
      </button>

      {open && (
        <div className="task-panel" role="dialog" aria-label="任务中心">
          <div className="task-panel-head">
            <span className="label">
              <IconLoader width={12} height={12} />
              任务中心
            </span>
            <span className="right" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span className="subtle">
                {running > 0 ? `${running} 个进行中` : finished > 0 ? `${finished} 个已完成` : ""}
              </span>
              {finished > 0 && (
                <button type="button" className="btn btn-sm btn-quiet" onClick={onClear}>
                  <IconTrash width={13} height={13} />
                  清除已完成
                </button>
              )}
            </span>
          </div>

          <div className="task-panel-body">
            {tasks.length === 0 && <p className="subtle" style={{ padding: "16px 4px" }}>暂无任务。耗时操作（如视频转换、PDF 压缩）会在这里显示进度，可切换工具继续使用。</p>}

            {tasks.map((t) => (
              <div key={t.id} className={`task-item ${t.status}`}>
                <div className="task-item-head">
                  <span className="task-tool">{t.toolName}</span>
                  <span className="task-label" title={t.label}>
                    {t.label}
                  </span>
                  <span className="task-status">
                    {t.status === "running" ? `${Math.round(t.progress * 100)}%` : t.status === "done" ? "完成" : "失败"}
                  </span>
                </div>

                {t.status === "running" && (
                  <div className="progress-track" style={{ marginTop: 8 }}>
                    <div className="progress-fill" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                  </div>
                )}

                {t.status === "done" && t.resultUrl && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <a className="btn btn-sm btn-primary" href={t.resultUrl} download={t.resultName}>
                      <IconDownload width={13} height={13} />
                      下载 {t.resultName}
                    </a>
                  </div>
                )}

                {t.status === "error" && <p className="task-error">{t.error}</p>}

                {t.log && (
                  <details className="task-log">
                    <summary>日志</summary>
                    <pre>{t.log}</pre>
                  </details>
                )}

                <button type="button" className="task-remove" onClick={() => onRemove(t.id)} title="移除任务" aria-label="移除任务">
                  <IconX width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
