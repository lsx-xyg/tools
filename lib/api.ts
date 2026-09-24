/** 前端 API 客户端 */

export interface OfflineTransferMeta {
  code: string;
  mode: "offline";
  expiresIn: number;
  expiresAt: number;
  maxDownloads: number;
  /** 上传时被自动转为「UTF-8 + BOM」的文件名（文本编码归一化） */
  converted?: string[];
}

/** 离线传输自定义参数：时长 1h～7 天，下载次数 1～100（服务端会 clamp） */
export interface OfflineOptions {
  ttlHours?: number;
  maxDownloads?: number;
}

export interface OfflineFileInfo {
  name: string;
  size: number;
  type: string;
  index: string;
}

export interface OfflineTransferDetail {
  code: string;
  kind: "text" | "file";
  text?: string;
  files?: OfflineFileInfo[];
  createdAt: number;
  expiresAt: number;
  downloadsLeft?: number;
  maxDownloads: number;
}

async function j<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `请求失败（${res.status}）`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

export async function createTextTransfer(text: string, opts?: OfflineOptions): Promise<OfflineTransferMeta> {
  return j(await fetch("/api/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "text", text, ...(opts?.ttlHours !== undefined ? { ttlHours: opts.ttlHours } : {}), ...(opts?.maxDownloads !== undefined ? { maxDownloads: opts.maxDownloads } : {}) }),
  }));
}

export async function createFileTransfer(files: File[], opts?: OfflineOptions): Promise<OfflineTransferMeta> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("kind", "file");
  if (opts?.ttlHours !== undefined) fd.append("ttlHours", String(opts.ttlHours));
  if (opts?.maxDownloads !== undefined) fd.append("maxDownloads", String(opts.maxDownloads));
  return j(await fetch("/api/transfer", { method: "POST", body: fd }));
}

export async function fetchTransfer(code: string): Promise<OfflineTransferDetail> {
  return j(await fetch(`/api/transfer/${code}`));
}

export async function deleteTransfer(code: string): Promise<void> {
  await j(await fetch(`/api/transfer/${code}`, { method: "DELETE" }));
}

export const offlineFileUrl = (code: string, index: string) => `/api/transfer/${code}/file/${index}`;

/* ---------- RTC 信令 ---------- */

export interface RtcRoomState {
  code: string;
  version: number;
  offer?: { sdp: string };
  answer?: { sdp: string };
  candidates: { sender: string[]; receiver: string[] };
  expiresAt: number;
}

export async function createRtcRoom(): Promise<{ code: string; mode: "rtc" }> {
  return j(await fetch("/api/rtc", { method: "POST" }));
}

export interface RtcRoomState {
  code: string;
  version: number;
  changed: boolean;
  offer?: { sdp: string };
  answer?: { sdp: string };
  candidates: { sender: string[]; receiver: string[] };
  expiresAt: number;
}

/**
 * 轮询房间状态。带 lastVersion 时服务端在版本未变的情况下只做 1 次 KV read
 * 即返回（changed=false），显著降低空闲轮询的 KV 请求量。
 */
export async function getRtcRoom(code: string, lastVersion?: number): Promise<RtcRoomState | null> {
  const q = lastVersion !== undefined && lastVersion >= 0 ? `?since=${lastVersion}` : "";
  const res = await fetch(`/api/rtc/${code}${q}`);
  if (res.status === 404 || res.status === 410) return null;
  return j<RtcRoomState>(res);
}

export async function postRtcOffer(code: string, sdp: string): Promise<void> {
  await j(await fetch(`/api/rtc/${code}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp }),
  }));
}

export async function postRtcAnswer(code: string, sdp: string): Promise<void> {
  await j(await fetch(`/api/rtc/${code}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp }),
  }));
}

export async function postRtcCandidate(
  code: string,
  role: "sender" | "receiver",
  sdp: string,
  seq: number,
): Promise<void> {
  await j(await fetch(`/api/rtc/${code}/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, sdp, seq }),
  }));
}

export async function deleteRtcRoom(code: string): Promise<void> {
  await fetch(`/api/rtc/${code}`, { method: "DELETE" }).catch(() => {});
}

export const rtcLink = (code: string, origin = location.origin) =>
  `${origin}/tools/transfer?mode=rtc&code=${code}`;
export const offlineLink = (code: string, origin = location.origin) =>
  `${origin}/tools/transfer?mode=offline&code=${code}`;
