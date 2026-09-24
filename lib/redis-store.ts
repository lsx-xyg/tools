/**
 * Redis 存储后端（Upstash Redis REST API 协议）。
 *
 * 为什么是 Upstash REST 而不是 TCP 直连：
 * Cloudflare Workers 免费计划没有 TCP 出站权限（connect() 仅付费计划可用），
 * 而 Upstash 提供 HTTPS REST 接口（标准 Redis 命令走 URL 路径），免费计划可直连。
 * 部署时配置两个环境变量即可启用：
 *   REDIS_URL   Upstash REST 端点，如 https://xxx.upstash.io
 *   REDIS_TOKEN Upstash 访问令牌
 *
 * 实现 KvLike 接口（与 KV 语义一致）：
 *   get    -> GET /get/<key>
 *   put    -> SET /set/<key>/<value> 或带 /ex/<seconds>
 *   delete -> DEL /del/<key>
 *   list   -> SCAN /scan/0/match/{prefix}×/count/1000（× 即通配星号），循环到游标为 0
 */

import type { KvLike } from "./kv";

export function createRedisStore(baseUrl: string, token: string): KvLike {
  const base = baseUrl.replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${token}` };

  async function cmd(...parts: (string | number)[]): Promise<unknown> {
    const path = parts.map((p) => encodeURIComponent(String(p))).join("/");
    const res = await fetch(`${base}/${path}`, { headers });
    if (!res.ok) {
      throw new Error(`redis ${parts[0]} failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(`redis ${parts[0]} failed: ${json.error}`);
    return json.result;
  }

  return {
    async get(key) {
      const r = await cmd("get", key);
      return r === null || r === undefined ? null : String(r);
    },

    async put(key, value, opts) {
      if (opts?.expiration !== undefined) {
        await cmd("set", key, value, "ex", opts.expiration);
      } else {
        await cmd("set", key, value);
      }
    },

    async delete(key) {
      await cmd("del", key);
    },

    async list(prefix) {
      const out: string[] = [];
      let cursor = "0";
      do {
        const r = await cmd("scan", cursor, "match", `${prefix}*`, "count", 1000);
        if (!Array.isArray(r)) break;
        const [next, keys] = r as [string, string[]];
        cursor = next ?? "0";
        if (Array.isArray(keys)) out.push(...keys);
      } while (cursor !== "0" && cursor !== undefined);
      return out.sort();
    },
  };
}

/** 从环境变量创建 Redis 后端；未配置时返回 null（上层回退 KV） */
export function redisStoreFromEnv(): KvLike | null {
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!url || !token) return null;
  return createRedisStore(url, token);
}
