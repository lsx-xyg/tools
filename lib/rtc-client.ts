/**
 * 在线 P2P 传输客户端（WebRTC DataChannel）
 * 信令经 /api/rtc/* 中转（只传 SDP/ICE，不传内容），内容在两端设备间直传。
 */

import {
  postRtcAnswer,
  postRtcCandidate,
  postRtcOffer,
  deleteRtcRoom,
  getRtcRoom,
} from "./api";
import { LIMITS } from "./limits";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export type RtcPhase =
  | "waiting" // 发送方等待接收方
  | "looking" // 接收方查找房间
  | "connecting" // 正在建立点对点连接
  | "transferring" // 传输中
  | "done" // 完成
  | "error";

export interface ReceivedFile {
  name: string;
  size: number;
  type: string;
  blob: Blob;
}

export interface RtcHooks {
  onPhase(p: RtcPhase, detail?: string): void;
  onProgress?(sent: number, total: number): void;
  onText?(text: string): void;
  onFiles?(files: ReceivedFile[]): void;
}

const POLL_MS = 350;
const CHUNK = 16 * 1024;
const BUFFER_HIGH = 512 * 1024;

// ---------------- 发送方 ----------------

export interface SenderSession {
  cancel(): void;
}

export function startSender(
  code: string,
  payload: { text?: string; files?: File[] },
  hooks: RtcHooks,
): SenderSession {
  let cancelled = false;
  let pc: RTCPeerConnection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let remoteDescSet = false;
  const pendingCandidates: RTCIceCandidateInit[] = [];
  let lastVersion = 0;

  async function poll() {
    if (cancelled) return;
    let room = null;
    try {
      room = await getRtcRoom(code);
    } catch {
      return;
    }
    if (!room) return;
    if (room.version === lastVersion) return;
    lastVersion = room.version;

    // 新 answer → 设置远端描述
    if (room.answer && !remoteDescSet && pc) {
      remoteDescSet = true;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: room.answer.sdp });
      } catch {
        fail("建立连接失败，请重试");
        return;
      }
      // 补投排队中的远端候选
      for (const c of pendingCandidates.splice(0)) {
        pc.addIceCandidate(c).catch(() => {});
      }
      hooks.onPhase("connecting");
    }
    // 新接收方候选 → 逐个 addIceCandidate
    if (pc && remoteDescSet && room.candidates.receiver.length) {
      for (const sdp of room.candidates.receiver) {
        try {
          await pc.addIceCandidate(JSON.parse(sdp));
        } catch {
          /* ignore */
        }
      }
      // 防止重复添加：记录已消费的版本即可，这里依赖 version 变化
      room.candidates.receiver.length = 0;
    }
  }

  function fail(msg: string) {
    cleanup(true);
    hooks.onPhase("error", msg);
  }

  function cleanup(delRoom = false) {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    pc = null;
    if (delRoom) void deleteRtcRoom(code);
  }

  (async () => {
    try {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const dc = pc.createDataChannel("tools", { ordered: true });
      dc.binaryType = "arraybuffer";

      dc.onopen = () => {
        if (cancelled) return;
        hooks.onPhase("transferring");
        void sendPayload(dc, payload, hooks, () => cancelled);
      };
      dc.onclose = () => {
        if (!cancelled) cleanup(true);
      };
      dc.onerror = () => fail("连接中断，请重试");

      pc.onicecandidate = (e) => {
        if (cancelled || !e.candidate) return;
        void postRtcCandidate(code, "sender", JSON.stringify(e.candidate.toJSON())).catch(
          () => {},
        );
      };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        const s = pc.connectionState;
        if (s === "connected") {
          hooks.onPhase("transferring");
        } else if (s === "failed") {
          fail("无法建立点对点连接，可尝试切换到离线传输");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await postRtcOffer(code, offer.sdp ?? "");
      hooks.onPhase("waiting");

      pollTimer = setInterval(poll, POLL_MS);
    } catch {
      fail("创建传输失败，请重试");
    }
  })();

  return {
    cancel: () => cleanup(true),
  };
}

async function sendPayload(
  dc: RTCDataChannel,
  payload: { text?: string; files?: File[] },
  hooks: RtcHooks,
  isCancelled: () => boolean,
) {
  try {
    if (payload.text !== undefined && payload.text !== "") {
      sendJson(dc, { t: "meta", mode: "text", size: payload.text.length });
      sendJson(dc, { t: "text", text: payload.text });
      sendJson(dc, { t: "done" });
      hooks.onProgress?.(1, 1);
    } else {
      const files = payload.files ?? [];
      const total = files.reduce((a, f) => a + f.size, 0);
      sendJson(dc, { t: "meta", mode: "files", count: files.length, total });
      let sent = 0;
      for (let i = 0; i < files.length; i++) {
        if (isCancelled()) return;
        const f = files[i];
        sendJson(dc, { t: "file", i, name: f.name, size: f.size, type: f.type });
        let off = 0;
        while (off < f.size) {
          if (isCancelled()) return;
          const end = Math.min(off + CHUNK, f.size);
          const buf = await f.slice(off, end).arrayBuffer();
          await sendBinary(dc, buf);
          sent += buf.byteLength;
          hooks.onProgress?.(sent, total);
          off = end;
        }
        sendJson(dc, { t: "fileEnd", i });
      }
      sendJson(dc, { t: "done" });
      hooks.onProgress?.(total, total);
    }
    hooks.onPhase("done");
  } catch {
    hooks.onPhase("error", "传输失败，请重试");
  }
}

function sendJson(dc: RTCDataChannel, obj: unknown) {
  dc.send(JSON.stringify(obj));
}

function sendBinary(dc: RTCDataChannel, buf: ArrayBuffer): Promise<void> {
  return new Promise((resolve) => {
    if (dc.bufferedAmount < BUFFER_HIGH) {
      dc.send(buf);
      resolve();
    } else {
      const onLow = () => {
        dc.removeEventListener("bufferedamountlow", onLow);
        dc.send(buf);
        resolve();
      };
      dc.addEventListener("bufferedamountlow", onLow);
    }
  });
}

// ---------------- 接收方 ----------------

export interface ReceiverSession {
  cancel(): void;
}

export function startReceiver(code: string, hooks: RtcHooks): ReceiverSession {
  let cancelled = false;
  let pc: RTCPeerConnection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let remoteDescSet = false;
  const pendingCandidates: RTCIceCandidateInit[] = [];
  let lastVersion = 0;
  let offerSeen = false;
  const startedAt = Date.now();

  async function poll() {
    if (cancelled) return;
    if (Date.now() - startedAt > LIMITS.rtcConnectTimeoutMs) {
      fail("等待发送方超时，请确认对方仍在传输页面");
      return;
    }
    let room = null;
    try {
      room = await getRtcRoom(code);
    } catch {
      return;
    }
    if (!room) return;
    if (room.version === lastVersion) return;
    lastVersion = room.version;

    // 收到 offer → 创建 answer
    if (room.offer && !offerSeen && !pc) {
      offerSeen = true;
      try {
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        setupChannel(pc);
        await pc.setRemoteDescription({ type: "offer", sdp: room.offer.sdp });
        remoteDescSet = true;
        for (const c of pendingCandidates.splice(0)) {
          pc.addIceCandidate(c).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postRtcAnswer(code, answer.sdp ?? "");
        hooks.onPhase("connecting");
      } catch {
        fail("建立连接失败，请重试");
        return;
      }
    }
    // 新发送方候选
    if (pc && room.candidates.sender.length) {
      for (const sdp of room.candidates.sender) {
        try {
          if (!remoteDescSet) {
            pendingCandidates.push(JSON.parse(sdp));
          } else {
            await pc.addIceCandidate(JSON.parse(sdp));
          }
        } catch {
          /* ignore */
        }
      }
      room.candidates.sender.length = 0;
    }
  }

  function setupChannel(pc: RTCPeerConnection) {
    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.binaryType = "arraybuffer";
      let meta: { mode?: "text" | "files"; total?: number; count?: number } = {};
      let text = "";
      const files: ReceivedFile[] = [];
      let cur: { i: number; name: string; size: number; type: string; parts: Blob[]; got: number } | null = null;
      let received = 0;

      dc.onmessage = (ev) => {
        if (cancelled) return;
        if (typeof ev.data === "string") {
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          switch (msg.t) {
            case "meta":
              meta = msg as { mode?: "text" | "files"; total?: number; count?: number };
              break;
            case "text":
              text = msg.text as string;
              break;
            case "file": {
              const m = msg as { i: number; name: string; size: number; type?: string };
              cur = { i: m.i, name: m.name, size: m.size, type: m.type ?? "", parts: [], got: 0 };
              files[m.i] = undefined as unknown as ReceivedFile;
              break;
            }
            case "fileEnd": {
              const i = (msg as { i: number }).i;
              if (cur && cur.i === i) {
                files[i] = { name: cur.name, size: cur.size, type: cur.type, blob: new Blob(cur.parts, { type: cur.type }) };
                cur = null;
              }
              break;
            }
            case "done": {
              if (meta.mode === "text") {
                hooks.onText?.(text);
                hooks.onPhase("done");
              } else {
                const list = files.filter(Boolean);
                hooks.onFiles?.(list);
                hooks.onPhase("done");
              }
              void cleanup(true);
              break;
            }
          }
        } else {
          const buf = ev.data as ArrayBuffer;
          if (cur) {
            cur.parts.push(new Blob([buf]));
            cur.got += buf.byteLength;
            received += buf.byteLength;
            if (meta.total) hooks.onProgress?.(received, meta.total);
          }
        }
      };
      dc.onclose = () => {
        if (!cancelled) cleanup(true);
      };
      dc.onerror = () => fail("连接中断，请重试");
    };
    pc.onicecandidate = (e) => {
      if (cancelled || !e.candidate) return;
      void postRtcCandidate(code, "receiver", JSON.stringify(e.candidate.toJSON())).catch(
        () => {},
      );
    };
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      if (pc.connectionState === "connected") {
        hooks.onPhase("transferring");
      } else if (pc.connectionState === "failed") {
        fail("无法建立点对点连接，可尝试让发送方改用离线传输");
      }
    };
  }

  function fail(msg: string) {
    cleanup(true);
    hooks.onPhase("error", msg);
  }

  function cleanup(delRoom = false) {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (pc) {
      pc.ondatachannel = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    pc = null;
    if (delRoom) void deleteRtcRoom(code);
  }

  hooks.onPhase("looking");
  pollTimer = setInterval(poll, POLL_MS);

  return { cancel: () => cleanup(true) };
}
