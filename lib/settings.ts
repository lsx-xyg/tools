/**
 * 存储后端切换设置：
 * - 当前后端（kv | redis）开关存绑定 KV（config:storage）
 * - 切换密码：优先环境变量 STORAGE_SWITCH_PASSWORD；
 *   未配置时可在网页首次设置，密码以 SHA-256 哈希存绑定 KV（config:storage_password）
 * 密码与开关始终读绑定 KV（getConfigKv），不随后端切换变化。
 */
import { getConfigKv, getStorage, invalidateBackendCache, CONFIG_STORAGE_KEY, type StorageBackend } from "./kv";

const CONFIG_PASSWORD_KEY = "config:storage_password";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** 当前后端配置 */
export async function getBackend(): Promise<StorageBackend> {
  const { backend } = await getStorage();
  return backend;
}

/** 是否已配置切换密码（环境变量优先，其次 KV 哈希） */
export async function hasPassword(): Promise<boolean> {
  if (process.env.STORAGE_SWITCH_PASSWORD) return true;
  const configKv = await getConfigKv();
  const raw = await configKv.get(CONFIG_PASSWORD_KEY);
  return !!raw;
}

/** 校验密码 */
export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const envPw = process.env.STORAGE_SWITCH_PASSWORD;
  if (envPw) return envPw === input;
  const configKv = await getConfigKv();
  const raw = await configKv.get(CONFIG_PASSWORD_KEY);
  if (!raw) return false;
  return (await sha256Hex(input)) === raw;
}

/** 首次设置 / 修改密码（修改需先过 verifyPassword 的旧密码） */
export async function setPassword(pw: string): Promise<void> {
  const configKv = await getConfigKv();
  await configKv.put(CONFIG_PASSWORD_KEY, await sha256Hex(pw));
}

/** 切换后端并失效缓存 */
export async function setBackend(b: StorageBackend): Promise<void> {
  const configKv = await getConfigKv();
  await configKv.put(CONFIG_STORAGE_KEY, b);
  invalidateBackendCache();
}
