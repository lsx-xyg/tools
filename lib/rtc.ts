/** 在线 P2P 传输的信令存储：仅中转 SDP/ICE，不存任何文件内容 */

import { getStorage, type KvLike } from "./kv";
import { LIMITS } from "./limits";

export interface RtcRoom {
  v: 1;
  code: string;
  offer?: { sdp: string };
  answer?: { sdp: string };
  candidates: { sender: string[]; receiver: string[] };
  createdAt: number;
  expiresAt: number;
  version: number;
}

export type RoomResult =
  | { ok: true; room: RtcRoom }
  | { ok: false; reason: "not_found" | "expired" | "conflict" };

function roomKey(code: string): string {
  return `rtc:${code}`;
}

function bump(room: RtcRoom, now: number): void {
  room.version += 1;
  room.expiresAt = now + LIMITS.rtcTtlMs;
}

export async function createRoom(code: string): Promise<RtcRoom> {
  const { kv } = await getStorage();
  const now = Date.now();
  const room: RtcRoom = {
    v: 1,
    code,
    candidates: { sender: [], receiver: [] },
    createdAt: now,
    expiresAt: now + LIMITS.rtcTtlMs,
    version: 0,
  };
  await putRoom(kv, room);
  return room;
}

async function putRoom(kv: KvLike, room: RtcRoom): Promise<void> {
  await kv.put(roomKey(room.code), JSON.stringify(room), {
    expiration: Math.floor(room.expiresAt / 1000),
  });
}

export async function getRoom(code: string): Promise<RoomResult> {
  const { kv } = await getStorage();
  const raw = await kv.get(roomKey(code));
  if (!raw) return { ok: false, reason: "not_found" };
  const room = JSON.parse(raw) as RtcRoom;
  if (Date.now() >= room.expiresAt) {
    await deleteRoom(room.code);
    return { ok: false, reason: "expired" };
  }
  return { ok: true, room };
}

/** 仅在房间存在且未被占用（无 answer）时写入 offer */
export async function setOffer(code: string, sdp: string): Promise<RoomResult> {
  const { kv } = await getStorage();
  const raw = await kv.get(roomKey(code));
  if (!raw) return { ok: false, reason: "not_found" };
  const room = JSON.parse(raw) as RtcRoom;
  if (Date.now() >= room.expiresAt) {
    await deleteRoom(room.code);
    return { ok: false, reason: "expired" };
  }
  if (room.answer) return { ok: false, reason: "conflict" }; // 已配对，不允许覆盖
  room.offer = { sdp };
  bump(room, Date.now());
  await putRoom(kv, room);
  return { ok: true, room };
}

export async function setAnswer(code: string, sdp: string): Promise<RoomResult> {
  const { kv } = await getStorage();
  const raw = await kv.get(roomKey(code));
  if (!raw) return { ok: false, reason: "not_found" };
  const room = JSON.parse(raw) as RtcRoom;
  if (Date.now() >= room.expiresAt) {
    await deleteRoom(room.code);
    return { ok: false, reason: "expired" };
  }
  if (!room.offer) return { ok: false, reason: "not_found" }; // 尚无 offer
  room.answer = { sdp };
  bump(room, Date.now());
  await putRoom(kv, room);
  return { ok: true, room };
}

export async function addCandidate(
  code: string,
  role: "sender" | "receiver",
  sdp: string,
): Promise<RoomResult> {
  const { kv } = await getStorage();
  const raw = await kv.get(roomKey(code));
  if (!raw) return { ok: false, reason: "not_found" };
  const room = JSON.parse(raw) as RtcRoom;
  if (Date.now() >= room.expiresAt) {
    await deleteRoom(room.code);
    return { ok: false, reason: "expired" };
  }
  room.candidates[role].push(sdp);
  // 单个方向候选过多则裁剪（防膨胀）
  if (room.candidates[role].length > 50) {
    room.candidates[role] = room.candidates[role].slice(-25);
  }
  bump(room, Date.now());
  await putRoom(kv, room);
  return { ok: true, room };
}

export async function deleteRoom(code: string): Promise<void> {
  const { kv } = await getStorage();
  await kv.delete(roomKey(code)).catch(() => {});
}
