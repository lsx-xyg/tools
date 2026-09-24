/**
 * 格式互转核心：YAML / XML / CSV / INI / Properties ↔ JSON
 * 全部纯本地计算，零网络请求。
 */
import YAML from "yaml";
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

/* ---------------- CSV（RFC4180 基础实现） ---------------- */
export function parseCsv(text: string): unknown {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      o[h] = r[i] ?? "";
    });
    return o;
  });
}

export function stringifyCsv(data: unknown): string {
  const arr = Array.isArray(data) ? data : [data];
  const objs = arr.filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v),
  );
  if (objs.length === 0) throw new Error("CSV 输出需要对象或对象数组（如 [{a:1},{a:2}]）");
  const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...objs.map((o) => keys.map((k) => esc(o[k])).join(","))].join("\n");
}

/* ---------------- INI ---------------- */
export function parseIni(text: string): unknown {
  const out: Record<string, Record<string, string> | string> = {};
  let section: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(";") || t.startsWith("#")) continue;
    const m = t.match(/^\[(.+)\]$/);
    if (m) {
      section = m[1].trim();
      out[section] = out[section] ?? {};
      continue;
    }
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (section) (out[section] as Record<string, string>)[k] = v;
    else out[k] = v;
  }
  return out;
}

export function stringifyIni(data: unknown): string {
  const o = (data ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  const scalars = Object.entries(o).filter(([, v]) => v === null || typeof v !== "object");
  const sections = Object.entries(o).filter(
    ([, v]) => !!v && typeof v === "object" && !Array.isArray(v),
  );
  scalars.forEach(([k, v]) => lines.push(`${k}=${v ?? ""}`));
  sections.forEach(([k, v]) => {
    lines.push(`[${k}]`);
    const flat = flatten(v as Record<string, unknown>);
    Object.entries(flat).forEach(([fk, fv]) => lines.push(`${fk}=${fv ?? ""}`));
  });
  return lines.join("\n");
}

/* ---------------- Properties ---------------- */
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

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, prefix + k + "."));
    } else {
      out[prefix + k] = v === null ? "" : String(v);
    }
  }
  return out;
}

/* ---------------- XML ---------------- */
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
      return normalize(YAML.parse(text));
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
      return YAML.stringify(data);
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
