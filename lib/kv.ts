/**
 * 存储抽象层：
 * - 生产（Cloudflare Workers）：KV / R2 绑定（经 getCloudflareContext 获取）
 * - 本地开发（next dev）：内存 Map + 本地文件目录 .local-store/
 * 内容语义保持一致，让前后端流程可在本地完整跑通。
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  /** 列出指定前缀下的全部 key（含前缀本身） */
  list(prefix: string): Promise<string[]>;
}

export interface ObjectLike {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ buffer: ArrayBuffer; size: number; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

// ---------- 本地实现 ----------

class LocalKv implements KvLike {
  private map = new Map<string, { v: string; exp?: number }>();
  async get(key: string): Promise<string | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.exp !== undefined && Date.now() / 1000 >= e.exp) {
      this.map.delete(key);
      return null;
    }
    return e.v;
  }
  async put(key: string, value: string, opts?: { expiration?: number }): Promise<void> {
    this.map.set(key, { v: value, exp: opts?.expiration });
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const now = Date.now() / 1000;
    for (const [k, e] of this.map) {
      if (!k.startsWith(prefix)) continue;
      if (e.exp !== undefined && now >= e.exp) {
        this.map.delete(k);
        continue;
      }
      out.push(k);
    }
    return out.sort();
  }
}

class LocalObjectStore implements ObjectLike {
  private dir = path.join(process.cwd(), ".local-store");
  private filePath(key: string) {
    // 防目录穿越：仅允许 [\w./-]
    if (!/^[\w./-]+$/.test(key)) throw new Error("invalid key");
    return path.join(this.dir, key);
  }
  async put(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
    const p = this.filePath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, Buffer.from(data));
    await writeFile(p + ".meta", JSON.stringify({ contentType }));
  }
  async get(key: string): Promise<{ buffer: ArrayBuffer; size: number; contentType: string } | null> {
    const p = this.filePath(key);
    if (!existsSync(p)) return null;
    const [buf, metaRaw] = await Promise.all([
      readFile(p),
      readFile(p + ".meta").catch(() => null),
    ]);
    let contentType = "application/octet-stream";
    if (metaRaw) {
      try {
        contentType = JSON.parse(metaRaw.toString()).contentType ?? contentType;
      } catch {
        /* ignore */
      }
    }
    const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { buffer, size: buf.byteLength, contentType };
  }
  async delete(key: string): Promise<void> {
    const p = this.filePath(key);
    await unlink(p).catch(() => {});
    await unlink(p + ".meta").catch(() => {});
  }
}

// ---------- 绑定获取 ----------

interface RawKvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}

interface WorkersEnv {
  TRANSFER_KV?: RawKvNamespace;
  TRANSFER_R2?: {
    put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<void>;
    get(key: string, opts?: { range?: string }): Promise<R2ObjectLike | null>;
    delete(key: string): Promise<void>;
  };
}

interface R2ObjectLike {
  body?: ReadableStream | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  size: number;
  httpMetadata?: { contentType?: string };
  range?: { offset: number; end?: number; length: number };
  httpEtag?: string;
}

let localKv: LocalKv | null = null;
let localObj: LocalObjectStore | null = null;

async function tryBindings(): Promise<{ kv: KvLike; obj: ObjectLike; rawR2: WorkersEnv["TRANSFER_R2"] } | null> {
  // next dev：getCloudflareContext 只会给 mock KV/R2（mock R2 不落盘），
  // 本地全链路验证改用内存 KV + .local-store 目录；生产部署才走真实绑定。
  if (process.env.NODE_ENV !== "production") return null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const e = env as WorkersEnv;
    if (!e.TRANSFER_KV || !e.TRANSFER_R2) return null;
    const r2 = e.TRANSFER_R2;
    const nskv = e.TRANSFER_KV;
    const kv: KvLike = {
      get: (k) => nskv.get(k),
      put: (k, v, o) => nskv.put(k, v, o),
      delete: (k) => nskv.delete(k),
      list: async (prefix) => {
        const res = await nskv.list({ prefix });
        return res.keys.map((k) => k.name);
      },
    };
    const obj: ObjectLike = {
      put: async (key, data, contentType) => {
        await r2.put(key, data, { httpMetadata: { contentType } });
      },
      get: async (key) => {
        const o = await r2.get(key);
        if (!o) return null;
        return {
          buffer: await o.arrayBuffer(),
          size: o.size,
          contentType: o.httpMetadata?.contentType ?? "application/octet-stream",
        };
      },
      delete: async (key) => {
        await r2.delete(key);
      },
    };
    return { kv, obj, rawR2: r2 };
  } catch {
    return null;
  }
}

export async function getStorage(): Promise<{
  kv: KvLike;
  obj: ObjectLike | null;
  rawR2: WorkersEnv["TRANSFER_R2"] | null;
  isLocal: boolean;
}> {
  const b = await tryBindings();
  if (b) return { kv: b.kv, obj: b.obj, rawR2: b.rawR2, isLocal: false };
  localKv ??= new LocalKv();
  localObj ??= new LocalObjectStore();
  return { kv: localKv, obj: localObj, rawR2: null, isLocal: true };
}
