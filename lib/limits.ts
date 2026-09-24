/** 共享限额与校验常量 */

export const LIMITS = {
  textMaxChars: 200_000,
  filesMaxCount: 10,
  fileMaxBytes: 10 * 1024 * 1024, // 10 MB
  filesTotalMaxBytes: 50 * 1024 * 1024, // 50 MB
  offlineTtlMs: 24 * 60 * 60 * 1000, // 24h
  offlineMaxDownloads: 10,
  rtcTtlMs: 15 * 60 * 1000, // 信令窗口 15 分钟
  rtcConnectTimeoutMs: 90 * 1000, // 客户端连接超时
} as const;

export function countChars(s: string): number {
  return Array.from(s).length;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

/** 校验文件数组，返回错误信息（无错误返回 null） */
export function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "请选择至少一个文件";
  if (files.length > LIMITS.filesMaxCount)
    return `一次最多发送 ${LIMITS.filesMaxCount} 个文件`;
  let total = 0;
  for (const f of files) {
    if (f.size <= 0) return "存在空文件，请移除后重试";
    if (f.size > LIMITS.fileMaxBytes)
      return `单个文件不能超过 10 MB（「${f.name}」过大）`;
    total += f.size;
  }
  if (total > LIMITS.filesTotalMaxBytes)
    return "所有文件总大小不能超过 50 MB";
  return null;
}
