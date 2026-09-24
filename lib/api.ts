/** 前端 API 客户端 */

export interface OfflineTransferMeta {
  code: string;
  mode: "offline";
  expiresIn: number;
  expiresAt: number;
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

export async function createTextTransfer(text: string): Promise<OfflineTransferMeta> {
  return j(await fetch("/api/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "text", text }),
  }));
}

export async function createFileTransfer(files: File[]): Promise<OfflineTransferMeta> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("kind", "file");
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

export async function getRtcRoom(code: string): Promise<RtcRoomState | null> {
  const res = await fetch(`/api/rtc/${code}`);
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
): Promise<void> {
  await j(await fetch(`/api/rtc/${code}/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, sdp }),
  }));
}

export async function deleteRtcRoom(code: string): Promise<void> {
  await fetch(`/api/rtc/${code}`, { method: "DELETE" }).catch(() => {});
}

export const rtcLink = (code: string, origin = location.origin) =>
  `${origin}/tools/transfer?mode=rtc&code=${code}`;
export const offlineLink = (code: string, origin = location.origin) =>
  `${origin}/tools/transfer?mode=offline&code=${code}`;
