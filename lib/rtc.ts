/**
 * 在线 P2P 传输的信令存储：仅中转 SDP/ICE，不存任何文件内容。
 *
 * 每个字段独立成 key（KV 单 key 写入是原子的，无读改写竞态）：
 *   rtc:<code>:meta           房间元信息（createdAt / expiresAt / version）
 *   rtc:<code>:offer          SDP offer（发送方写一次）
 *   rtc:<code>:answer         SDP answer（接收方写一次）
 *   rtc:<code>:c:sender:<seq> ICE 候选（发送方，seq 单调递增）
 *   rtc:<code>:c:receiver:<seq> ICE 候选（接收方）
 *
 * 这样并发提交 offer / answer / candidate 时不会互相覆盖——
 * 此前单 key 读改写（先读整房间 → 改 → 写回）存在竞态：
 * 发送方的 ICE 候选与 offer 并发写入时会互相丢失字段，导致无法建连。
 */

import { getStorage, type KvLike } from "./kv";
import { LIMITS } from "./limits";

export interface RtcRoomMeta {
  v: 1;
  code: string;
  createdAt: number;
  expiresAt: number;
  version: number;
}

export interface RtcRoomState {
  code: string;
  version: number;
  offer?: { sdp: string };
  answer?: { sdp: string };
  candidates: { sender: string[]; receiver: string[] };
  createdAt: number;
  expiresAt: number;
}

export type RoomResult =
  | { ok: true; room: RtcRoomState }
  | { ok: false; reason: "not_found" | "expired" | "conflict" };

export type WriteResult =
  | { ok: true; version: number }
  | { ok: false; reason: "not_found" | "expired" | "conflict" };

const P = (code: string, ...rest: string[]) => `rtc:${code}:${rest.join(":")}`;
const SENDER = "c:sender:";
const RECEIVER = "c:receiver:";

function expSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function pad(seq: number): string {
  return String(seq).padStart(6, "0");
}

async function metaOf(kv: KvLike, code: string): Promise<RtcRoomMeta | null> {
  const raw = await kv.get(P(code, "meta"));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RtcRoomMeta;
  } catch {
    return null;
  }
}

async function bumpMeta(kv: KvLike, code: string, meta: RtcRoomMeta): Promise<void> {
  meta.version += 1;
  meta.expiresAt = Date.now() + LIMITS.rtcTtlMs;
  await kv.put(P(code, "meta"), JSON.stringify(meta), {
    expiration: expSeconds(meta.expiresAt),
  });
}

export async function createRoom(code: string): Promise<RtcRoomMeta> {
  const { kv } = await getStorage();
  const now = Date.now();
  const meta: RtcRoomMeta = {
    v: 1,
    code,
    createdAt: now,
    expiresAt: now + LIMITS.rtcTtlMs,
    version: 0,
  };
  await kv.put(P(code, "meta"), JSON.stringify(meta), {
    expiration: expSeconds(meta.expiresAt),
  });
  return meta;
}

export async function getRoom(code: string): Promise<RoomResult> {
  const { kv } = await getStorage();
  const meta = await metaOf(kv, code);
  if (!meta) return { ok: false, reason: "not_found" };
  if (Date.now() >= meta.expiresAt) {
    await deleteRoom(code);
    return { ok: false, reason: "expired" };
  }

  const keys = await kv.list(P(code));
  const offerRaw = (await kv.get(P(code, "offer"))) ?? undefined;
  const answerRaw = (await kv.get(P(code, "answer"))) ?? undefined;
  const sender: string[] = [];
  const receiver: string[] = [];

  await Promise.all(
    keys
      .filter((k) => k.startsWith(P(code, SENDER)))
      .map(async (k) => {
        const v = await kv.get(k);
        if (v !== null) sender.push(v);
      }),
  );
  await Promise.all(
    keys
      .filter((k) => k.startsWith(P(code, RECEIVER)))
      .map(async (k) => {
        const v = await kv.get(k);
        if (v !== null) receiver.push(v);
      }),
  );

  return {
    ok: true,
    room: {
      code,
      version: meta.version,
      offer: offerRaw !== undefined ? { sdp: offerRaw } : undefined,
      answer: answerRaw !== undefined ? { sdp: answerRaw } : undefined,
      candidates: { sender, receiver },
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
    },
  };
}

export async function setOffer(code: string, sdp: string): Promise<WriteResult> {
  const { kv } = await getStorage();
  const meta = await metaOf(kv, code);
  if (!meta) return { ok: false, reason: "not_found" };
  if (Date.now() >= meta.expiresAt) {
    await deleteRoom(code);
    return { ok: false, reason: "expired" };
  }
  if ((await kv.get(P(code, "answer"))) !== null) {
    return { ok: false, reason: "conflict" };
  }
  await kv.put(P(code, "offer"), sdp, { expiration: expSeconds(meta.expiresAt) });
  await bumpMeta(kv, code, meta);
  return { ok: true, version: meta.version };
}

export async function setAnswer(code: string, sdp: string): Promise<WriteResult> {
  const { kv } = await getStorage();
  const meta = await metaOf(kv, code);
  if (!meta) return { ok: false, reason: "not_found" };
  if (Date.now() >= meta.expiresAt) {
    await deleteRoom(code);
    return { ok: false, reason: "expired" };
  }
  if ((await kv.get(P(code, "offer"))) === null) {
    return { ok: false, reason: "not_found" };
  }
  if ((await kv.get(P(code, "answer"))) !== null) {
    return { ok: false, reason: "conflict" };
  }
  await kv.put(P(code, "answer"), sdp, { expiration: expSeconds(meta.expiresAt) });
  await bumpMeta(kv, code, meta);
  return { ok: true, version: meta.version };
}

export async function addCandidate(
  code: string,
  role: "sender" | "receiver",
  sdp: string,
  seq: number,
): Promise<WriteResult> {
  const { kv } = await getStorage();
  const meta = await metaOf(kv, code);
  if (!meta) return { ok: false, reason: "not_found" };
  if (Date.now() >= meta.expiresAt) {
    await deleteRoom(code);
    return { ok: false, reason: "expired" };
  }
  const direction = role === "sender" ? SENDER : RECEIVER;
  await kv.put(P(code, direction, pad(seq)), sdp, {
    expiration: expSeconds(meta.expiresAt),
  });
  await bumpMeta(kv, code, meta);
  // 防膨胀：单方向候选超过上限则裁剪最旧的
  const keys = await kv.list(P(code, direction));
  if (keys.length > 50) {
    const drop = keys.length - 50;
    await Promise.all(keys.slice(0, drop).map((k) => kv.delete(k).catch(() => {})));
  }
  return { ok: true, version: meta.version };
}

export async function deleteRoom(code: string): Promise<void> {
  const { kv } = await getStorage();
  const keys = await kv.list(P(code)).catch(() => [] as string[]);
  await Promise.all(keys.map((k) => kv.delete(k).catch(() => {})));
  await kv.delete(P(code, "meta")).catch(() => {});
}
