/**
 * 在线 P2P 传输客户端（WebRTC DataChannel）
 * 信令经 /api/rtc/* 中转（只传 SDP/ICE，不传内容），内容在两端设备间直传。
 *
 * 消费策略：数据驱动（不再依赖服务端 version 去重）——
 * 每次轮询拿到的完整房间状态里，用「本端已消费的候选数量」取增量，
 * offer/answer 用一次性标志；候选在远端描述就绪前先排队。
 * 这样即使 KV 最终一致性导致某次轮询数据缺失，下一次轮询也能补上。
 */

import {
  postRtcAnswer,
  postRtcCandidate,
  postRtcOffer,
  deleteRtcRoom,
  getRtcRoom,
} from "./api";
import { LIMITS } from "./limits";
import { isTextFile, normalizeTextEncoding } from "./text-encoding";

const ICE_SERVERS: RTCIceServer[] = [
  // 同局域网/同 WiFi 主要靠 host candidate 直连，STUN 只是拿公网地址的辅助。
  // 不用 Google STUN（国内不可达）；Cloudflare 在中国大陆一般可达，另配一个公开备用。
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.stunprotocol.org:3478" },
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

const POLL_MS = 1000;
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
  let completed = false;
  let payloadSent = false;
  let pc: RTCPeerConnection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let remoteDescSet = false;
  let candSeq = 0;
  let lastReceiverCount = 0;
  let lastVersion = -1;
  const startedAt = Date.now();
  const pendingCandidates: RTCIceCandidateInit[] = [];

  async function poll() {
    if (cancelled || completed) return;
    // 发送端也要超时：对方一直不加入时停止轮询并清理房间，避免后台空转消耗 KV
    if (Date.now() - startedAt > LIMITS.rtcConnectTimeoutMs) {
      fail("等待对方加入超时，请重试");
      return;
    }
    let room = null;
    try {
      // 带 lastVersion：版本未变时服务端只做 1 次 KV read，不 list 不逐 key get
      room = await getRtcRoom(code, lastVersion);
    } catch {
      return;
    }
    if (!room) return;
    if (!room.changed) return;
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
      for (const c of pendingCandidates.splice(0)) {
        pc.addIceCandidate(c).catch(() => {});
      }
      hooks.onPhase("connecting");
    }
    // 新接收方候选 → 取增量逐个添加
    const rc = room.candidates.receiver;
    if (pc && rc.length > lastReceiverCount) {
      for (let i = lastReceiverCount; i < rc.length; i++) {
        try {
          const cand = JSON.parse(rc[i]) as RTCIceCandidateInit;
          if (!remoteDescSet) pendingCandidates.push(cand);
          else pc.addIceCandidate(cand).catch(() => {});
        } catch {
          /* ignore */
        }
      }
      lastReceiverCount = rc.length;
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
        if (cancelled || completed) return;
        // 连接已建立：停止信令轮询（此后不再有 KV 请求）
        if (pollTimer) clearInterval(pollTimer);
        hooks.onPhase("transferring");
        void sendPayload(dc, payload, hooks, () => cancelled, () => {
          payloadSent = true;
        });
      };
      dc.onmessage = (ev) => {
        if (cancelled || completed || typeof ev.data !== "string") return;
        try {
          const msg = JSON.parse(ev.data) as { t?: string };
          // 接收端回执：收到 ack 才真正判定送达，避免单向误报成功
          if (msg.t === "ack") {
            completed = true;
            hooks.onPhase("done");
          }
        } catch {
          /* ignore */
        }
      };
      dc.onclose = () => {
        if (cancelled) return;
        // 数据已写完、对端主动关闭（对端完成接收后 800ms 拆除）→ 兜底判定送达
        if (payloadSent && !completed) {
          completed = true;
          hooks.onPhase("done");
        }
        cleanup(true);
      };
      dc.onerror = () => {
        if (completed || payloadSent) {
          cleanup(true);
          return;
        }
        fail("连接中断，请重试");
      };

      pc.onicecandidate = (e) => {
        if (cancelled || !e.candidate) return;
        const seq = candSeq++;
        void postRtcCandidate(code, "sender", JSON.stringify(e.candidate.toJSON()), seq).catch(
          () => {},
        );
      };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        const s = pc.connectionState;
        if (s === "connected") {
          // 可能晚于 DataChannel onopen 派发，不得覆盖已完成状态
          if (!completed) hooks.onPhase("transferring");
        } else if (s === "failed") {
          if (completed) {
            cleanup(true);
            return;
          }
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
  onComplete: () => void,
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
    // 不在此判定完成：数据只是写完通道，需等接收端 ack 回执（dc.onmessage）
    // 或对端完成接收后关闭连接（dc.onclose 兜底），避免单向误报成功。
    onComplete();
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
  let finished = false;
  let pc: RTCPeerConnection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let remoteDescSet = false;
  let candSeq = 0;
  let lastSenderCount = 0;
  let offerSeen = false;
  let lastVersion = -1;
  const pendingCandidates: RTCIceCandidateInit[] = [];
  const startedAt = Date.now();

  async function poll() {
    if (cancelled || finished) return;
    if (Date.now() - startedAt > LIMITS.rtcConnectTimeoutMs) {
      fail("等待发送方超时，请确认对方仍在传输页面");
      return;
    }
    let room = null;
    try {
      room = await getRtcRoom(code, lastVersion);
    } catch {
      return;
    }
    if (!room) return;
    if (!room.changed) return;
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
    // 新发送方候选 → 取增量
    const sc = room.candidates.sender;
    if (pc && sc.length > lastSenderCount) {
      for (let i = lastSenderCount; i < sc.length; i++) {
        try {
          const cand = JSON.parse(sc[i]) as RTCIceCandidateInit;
          if (!remoteDescSet) pendingCandidates.push(cand);
          else pc.addIceCandidate(cand).catch(() => {});
        } catch {
          /* ignore */
        }
      }
      lastSenderCount = sc.length;
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
      const pendingNorm: Promise<void>[] = [];

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
                const c = cur;
                cur = null;
                const name = c.name;
                const type = c.type;
                const size = c.size;
                const blob = new Blob(c.parts, { type: c.type });
                // 文本类文件归一化为「UTF-8 + BOM」，与离线上传链路行为一致，
                // 保证接收端任何系统打开都能正确显示中文。
                const p = (async () => {
                  try {
                    if (isTextFile(name, type)) {
                      const buf = new Uint8Array(await blob.arrayBuffer());
                      const norm = normalizeTextEncoding(buf);
                      files[i] = { name, size: norm.data.byteLength, type, blob: new Blob([norm.data], { type }) };
                    } else {
                      files[i] = { name, size, type, blob };
                    }
                  } catch {
                    files[i] = { name, size, type, blob };
                  }
                })();
                pendingNorm.push(p);
              }
              break;
            }
            case "done": {
              finished = true;
              void (async () => {
                // 等待所有文本归一化完成再组装结果，避免文件被 filter(Boolean) 丢弃
                if (pendingNorm.length) await Promise.all(pendingNorm);
                if (meta.mode === "text") {
                  hooks.onText?.(text);
                  hooks.onPhase("done");
                } else {
                  const list = files.filter(Boolean);
                  hooks.onFiles?.(list);
                  hooks.onPhase("done");
                }
                // 回执发送方：内容已在本端接收并处理完成
                try {
                  dc.send(JSON.stringify({ t: "ack" }));
                } catch {
                  /* ignore：连接可能已关闭 */
                }
                // 优雅收尾：稍等片刻让发送端观察到正常关闭，再拆除本端
                setTimeout(() => cleanup(true), 800);
              })();
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
      dc.onerror = () => {
        if (finished) {
          cleanup(true);
          return;
        }
        fail("连接中断，请重试");
      };
    };
    pc.onicecandidate = (e) => {
      if (cancelled || !e.candidate) return;
      const seq = candSeq++;
      void postRtcCandidate(code, "receiver", JSON.stringify(e.candidate.toJSON()), seq).catch(
        () => {},
      );
    };
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      if (pc.connectionState === "connected") {
        // 连接已建立：停止信令轮询（此后不再有 KV 请求）
        if (pollTimer) clearInterval(pollTimer);
        hooks.onPhase("transferring");
      } else if (pc.connectionState === "failed") {
        if (finished) {
          cleanup(true);
          return;
        }
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
