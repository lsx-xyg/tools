/**
 * 生成 Simple Icons 图标索引（仅元数据：slug / title / hex / 导出 key），
 * 供徽章生成器的图标搜索使用。不含 SVG path，体积可控。
 * 运行：node scripts/build-icon-index.mjs
 */
import * as si from "simple-icons";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entries = Object.entries(si)
  .filter(([k]) => k.startsWith("si"))
  .map(([key, v]) => ({ key, slug: v.slug, title: v.title, hex: v.hex }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "si-icons.json"), JSON.stringify(entries));
console.log(`si-icons.json: ${entries.length} icons, ${Math.round((JSON.stringify(entries).length) / 1024)} KB`);
