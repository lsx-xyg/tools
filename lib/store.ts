/** 离线传输（云端 24h 暂存）存储逻辑：KV 记录 + R2 文件 */

import { getStorage } from "./kv";
import { LIMITS } from "./limits";

export interface FileMeta {
  name: string;
  size: number;
  type: string;
  key: string; // R2 对象 key：<code>/<idx>
}

export interface TransferRecord {
  v: 1;
  code: string;
  kind: "text" | "file";
  text?: string;
  files?: FileMeta[];
  createdAt: number;
  expiresAt: number;
  maxDownloads: number;
  downloads: number;
}

export type TransferResult =
  | { ok: true; record: TransferRecord }
  | { ok: false; reason: "not_found" | "expired" | "download_limit" };

function absoluteExpiration(expiresAt: number): number {
  return Math.floor(expiresAt / 1000);
}

export async function createTransfer(
  input: { kind: "text"; text: string } | { kind: "file"; files: { name: string; size: number; type: string; data: ArrayBuffer }[] },
  code: string,
): Promise<TransferRecord> {
  const { kv, obj } = await getStorage();
  const now = Date.now();
  const record: TransferRecord = {
    v: 1,
    code,
    kind: input.kind,
    createdAt: now,
    expiresAt: now + LIMITS.offlineTtlMs,
    maxDownloads: LIMITS.offlineMaxDownloads,
    downloads: 0,
  };

  if (input.kind === "text") {
    record.text = input.text;
  } else {
    record.files = input.files.map((f, i) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      key: `${code}/${i}`,
    }));
    if (obj) {
      await Promise.all(
        input.files.map((f, i) => obj.put(`${code}/${i}`, f.data, f.type || "application/octet-stream")),
      );
    }
  }

  await kv.put(code, JSON.stringify(record), { expiration: absoluteExpiration(record.expiresAt) });
  return record;
}

export async function getTransfer(code: string): Promise<TransferResult> {
  const { kv } = await getStorage();
  const raw = await kv.get(code);
  if (!raw) return { ok: false, reason: "not_found" };
  const record = JSON.parse(raw) as TransferRecord;

  if (Date.now() >= record.expiresAt) {
    await deleteTransfer(record);
    return { ok: false, reason: "expired" };
  }
  return { ok: true, record };
}

/** 文件下载前调用：校验下载次数并计数 */
export async function consumeDownload(record: TransferRecord): Promise<TransferResult> {
  const { kv } = await getStorage();
  if (Date.now() >= record.expiresAt) {
    await deleteTransfer(record);
    return { ok: false, reason: "expired" };
  }
  if (record.kind !== "file") return { ok: true, record };
  if (record.downloads >= record.maxDownloads) {
    return { ok: false, reason: "download_limit" };
  }
  record.downloads += 1;
  await kv.put(record.code, JSON.stringify(record), {
    expiration: absoluteExpiration(record.expiresAt),
  });
  return { ok: true, record };
}

export async function deleteTransfer(record: TransferRecord): Promise<void> {
  const { kv, obj } = await getStorage();
  await kv.delete(record.code).catch(() => {});
  if (record.files && obj) {
    await Promise.all(
      record.files.map((f) => obj.delete(f.key).catch(() => {})),
    );
  }
}
