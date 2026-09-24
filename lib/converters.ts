/**
 * 格式互转核心：YAML / XML / CSV / INI / Properties ↔ JSON
 * 依赖选型（参考社区成熟方案）：
 *   JSON → 原生 JSON.parse / JSON.stringify
 *   YAML → js-yaml（最成熟，支持注释、锚点）
 *   XML  → fast-xml-parser（快，支持保留属性）
 *   CSV  → papaparse（引号 / 换行 / 分隔符处理最稳）
 *   INI  → ini（轻量）
 * 全部纯本地计算，零网络请求。
 */
import { dump as yamlDump, load as yamlLoad } from "js-yaml";
import Papa from "papaparse";
import ini from "ini";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

export type Format = "json" | "yaml" | "xml" | "csv" | "ini" | "properties";

export const FORMATS: { id: Format; name: string }[] = [
  { id: "json", name: "JSON" },
  { id: "yaml", name: "YAML" },
  { id: "xml", name: "XML" },
  { id: "csv", name: "CSV" },
  { id: "ini", name: "INI" },
  { id: "properties", name: "Properties" },
];

/** 把解析结果规整为 JSON 兼容值（Date → ISO 字符串等） */
function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return String(v);
  }
}

/* ---------------- CSV（papaparse） ---------------- */
export function parseCsv(text: string): unknown {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    const e = result.errors[0];
    throw new Error(`CSV 第 ${e.row ?? "?"} 行解析失败：${e.message}`);
  }
  return result.data;
}

export function stringifyCsv(data: unknown): string {
  const arr = Array.isArray(data) ? data : [data];
  const objs = arr.filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v),
  );
  if (objs.length === 0) throw new Error("CSV 输出需要对象或对象数组（如 [{a:1},{a:2}]）");
  // 对象 / 数组值预转 JSON 字符串，避免 papaparse 输出 "[object Object]"
  const rows = objs.map((o) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toText(v)])),
  );
  return Papa.unparse(rows);
}

/* ---------------- INI（ini 包） ---------------- */
export function parseIni(text: string): unknown {
  return ini.parse(text);
}

export function stringifyIni(data: unknown): string {
  return ini.stringify((data ?? {}) as Record<string, unknown>);
}

/* ---------------- Properties（Java properties，无成熟专用包，手写） ---------------- */
export function parseProperties(text: string): unknown {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("!")) continue;
    const idx = t.search(/[=:]/);
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1).trim();
    if (t[idx] === ":" && v.startsWith(" ")) v = v.slice(1);
    out[k] = v;
  }
  return out;
}

export function stringifyProperties(data: unknown): string {
  const flat = flatten((data ?? {}) as Record<string, unknown>);
  return Object.entries(flat)
    .map(([k, v]) => `${k}=${v ?? ""}`)
    .join("\n");
}

/** 对象拍平为点号键；数组 / 对象值转 JSON 字符串（避免 "[object Object]"） */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, prefix + k + "."));
    } else {
      out[prefix + k] = toText(v);
    }
  }
  return out;
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ---------------- XML（fast-xml-parser） ---------------- */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
});

export function parseXml(text: string): unknown {
  return xmlParser.parse(text);
}

export function stringifyXml(data: unknown): string {
  const root = Array.isArray(data) ? { root: data } : data;
  return xmlBuilder.build(root as Record<string, unknown>);
}

/* ---------------- 统一入口 ---------------- */
export function parseText(text: string, format: Format): unknown {
  switch (format) {
    case "json":
      return normalize(JSON.parse(text));
    case "yaml":
      return normalize(yamlLoad(text));
    case "xml":
      return normalize(parseXml(text));
    case "csv":
      return parseCsv(text);
    case "ini":
      return parseIni(text);
    case "properties":
      return parseProperties(text);
  }
}

export function stringifyData(data: unknown, format: Format): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yamlDump(data, { lineWidth: -1, noRefs: true });
    case "xml":
      return stringifyXml(data);
    case "csv":
      return stringifyCsv(data);
    case "ini":
      return stringifyIni(data);
    case "properties":
      return stringifyProperties(data);
  }
}

/** 各格式示例（用于一键填充） */
export const EXAMPLES: Record<Format, string> = {
  json: JSON.stringify(
    { name: "工具箱", items: [{ id: 1, active: true }, { id: 2, active: false }], note: null },
    null,
    2,
  ),
  yaml: `name: 工具箱\nitems:\n  - id: 1\n    active: true\n  - id: 2\n    active: false\nnote: null\n`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>\n<config name="工具箱">\n  <items>\n    <item id="1" active="true"/>\n    <item id="2" active="false"/>\n  </items>\n  <note>null</note>\n</config>\n`,
  csv: `name,id,active\n工具箱,1,true\n工具箱,2,false\n`,
  ini: `name=工具箱\n\n[items]\nitem1=id 1\nitem2=id 2\n`,
  properties: `name=工具箱\napp.version=1.0.0\nfeature.enabled=true\n`,
};
