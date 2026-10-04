"use client";

import { useMemo, useState } from "react";
import { IconArrowRight } from "./icons";
import type { DemoField, ExcelFn } from "@/lib/excel-functions";

/** 内置模拟表：lookup / index / match / xlookup / choose 共用 */
const STAFF = [
  { id: "E01", name: "张三", dept: "技术部", salary: 12000 },
  { id: "E02", name: "李四", dept: "市场部", salary: 10000 },
  { id: "E03", name: "王五", dept: "财务部", salary: 15000 },
  { id: "E04", name: "赵六", dept: "技术部", salary: 13000 },
] as const;

/** stats 固定成绩数据 */
const SCORES: number[] = [45, 72, 88, 91, 66];
const SUM_ALL = SCORES.reduce((a, b) => a + b, 0);

function fieldValue(
  fields: DemoField[],
  vals: Record<string, string | number>,
  key: string,
): string | number {
  const f = fields.find((x) => x.key === key);
  if (!f) return "";
  if (f.kind === "number") {
    const n = Number(vals[key]);
    return Number.isFinite(n) ? n : f.def;
  }
  return String(vals[key] ?? f.def);
}

function num(fields: DemoField[], vals: Record<string, string | number>, key: string): number {
  const v = Number(fieldValue(fields, vals, key));
  return Number.isFinite(v) ? v : NaN;
}

function txt(fields: DemoField[], vals: Record<string, string | number>, key: string): string {
  return String(fieldValue(fields, vals, key));
}

/** 按函数名 + kind 实时计算，返回 { result, error? } */
function compute(fn: ExcelFn, fields: DemoField[], vals: Record<string, string | number>) {
  const name = fn.name.toUpperCase();
  const kind = fn.demo?.kind ?? "calc";
  try {
    switch (kind) {
      case "calc": {
        const nums = fields.filter((f) => f.kind === "number").map((f) => num(fields, vals, f.key));
        if (nums.some((n) => !Number.isFinite(n))) return { error: "请输入有效数字" };
        if (name === "SUM") return { result: String(nums.reduce((a, b) => a + b, 0)) };
        if (name === "AVERAGE") return { result: String(nums.reduce((a, b) => a + b, 0) / nums.length) };
        if (name === "COUNT") return { result: String(nums.filter((n) => Number.isFinite(n)).length) };
        if (name === "MAX") return { result: String(Math.max(...nums)) };
        if (name === "MIN") return { result: String(Math.min(...nums)) };
        return { result: "—" };
      }
      case "math1": {
        const n = num(fields, vals, "n");
        const d = num(fields, vals, "d");
        if (!Number.isFinite(n)) return { error: "请输入有效数字" };
        switch (name) {
          case "ABS":
            return { result: String(Math.abs(n)) };
          case "INT":
            return { result: String(Math.floor(n)) };
          case "SQRT":
            if (n < 0) return { error: "负数没有实数平方根" };
            return { result: String(Math.sqrt(n)) };
          case "ROUNDUP":
            return { result: String(roundAway(n, d, true)) };
          case "ROUNDDOWN":
            return { result: String(roundAway(n, d, false)) };
          case "TRUNC":
            return { result: String(trunc(n, d)) };
          case "POWER":
            return { result: String(Math.pow(n, Number.isFinite(d) ? d : 1)) };
          case "MOD": {
            if (d === 0 || !Number.isFinite(d)) return { error: "除数不能为 0" };
            return { result: String(((n % d) + d) % d) };
          }
          case "ROUND":
            return { result: String(roundHalfUp(n, d)) };
          default:
            return { result: "—" };
        }
      }
      case "text": {
        const s = txt(fields, vals, "s");
        const n = num(fields, vals, "n");
        switch (name) {
          case "LEFT":
            return { result: s.slice(0, Math.max(0, Number.isFinite(n) ? n : 1)) };
          case "RIGHT": {
            const k = Math.max(0, Number.isFinite(n) ? n : 1);
            return { result: k === 0 ? "" : s.slice(-k) };
          }
          case "MID": {
            const start = Math.max(0, Number.isFinite(n) ? n - 1 : 0);
            const len = Math.max(0, Number.isFinite(num(fields, vals, "len")) ? num(fields, vals, "len") : 1);
            return { result: s.slice(start, start + len) };
          }
          case "LEN":
            return { result: String(Array.from(s).length) };
          case "TRIM":
            return { result: s.replace(/\s+/g, " ").trim() };
          case "UPPER":
            return { result: s.toUpperCase() };
          case "LOWER":
            return { result: s.toLowerCase() };
          case "PROPER":
            return { result: s.replace(/\b\w/g, (c) => c.toUpperCase()) };
          case "SUBSTITUTE": {
            const old = txt(fields, vals, "old");
            const next = txt(fields, vals, "new");
            return { result: old === "" ? s : s.split(old).join(next) };
          }
          case "REPLACE": {
            const start = Math.max(0, Number.isFinite(n) ? n - 1 : 0);
            const len = Math.max(0, Number.isFinite(num(fields, vals, "len")) ? num(fields, vals, "len") : 0);
            const next = txt(fields, vals, "new");
            return { result: s.slice(0, start) + next + s.slice(start + len) };
          }
          case "FIND": {
            const needle = txt(fields, vals, "needle");
            const idx = s.indexOf(needle);
            if (idx < 0) return { error: "未找到，返回 #VALUE!" };
            return { result: String(idx + 1) };
          }
          case "CONCATENATE": {
            const a = txt(fields, vals, "a");
            const b = txt(fields, vals, "b");
            return { result: `${a}-${b}` };
          }
          default:
            return { result: "—" };
        }
      }
      case "logical": {
        const score = num(fields, vals, "score");
        const den = num(fields, vals, "den");
        const att = num(fields, vals, "att");
        switch (name) {
          case "IF":
            if (!Number.isFinite(score)) return { error: "请输入分数" };
            return {
              result: score >= 90 ? "优" : score >= 60 ? "及格" : "不及格",
            };
          case "IFERROR":
            if (!Number.isFinite(den)) return { error: "请输入除数" };
            return den === 0 ? { result: "除数不能为 0" } : { result: String(100 / den) };
          case "AND":
            return {
              result: String(Number.isFinite(score) && score >= 60 && Number.isFinite(att) && att >= 80),
            };
          case "IFS":
            if (!Number.isFinite(score)) return { error: "请输入分数" };
            return { result: score >= 90 ? "优" : score >= 80 ? "良" : score >= 60 ? "及格" : "不及格" };
          default:
            return { result: "—" };
        }
      }
      case "lookup": {
        const lookup = txt(fields, vals, "lookup");
        const rowIx = num(fields, vals, "row");
        const colIx = num(fields, vals, "col");
        const idx = num(fields, vals, "idx");
        switch (name) {
          case "VLOOKUP": {
            const row = STAFF.find((r) => r.id === lookup);
            if (!row) return { error: `未找到工号 ${lookup}，返回 #N/A` };
            const col = Math.max(2, Math.min(4, Number(colIx) || 2));
            const v = col === 2 ? row.name : col === 3 ? row.dept : String(row.salary);
            return { result: v, highlight: STAFF.indexOf(row) };
          }
          case "XLOOKUP": {
            const row = STAFF.find((r) => r.name === lookup);
            if (!row) return { error: `未找到姓名 ${lookup}，返回未找到` };
            return { result: row.id, highlight: STAFF.indexOf(row) };
          }
          case "MATCH": {
            const row = STAFF.find((r) => r.id === lookup);
            if (!row) return { error: `未找到 ${lookup}` };
            return { result: String(STAFF.indexOf(row) + 1), highlight: STAFF.indexOf(row) };
          }
          case "INDEX": {
            const r = Number.isFinite(rowIx) ? rowIx : 1;
            const c = Number.isFinite(colIx) ? colIx : 1;
            const row = STAFF[Math.max(1, Math.min(4, Math.round(r))) - 1];
            const col = Math.max(1, Math.min(4, Math.round(c)));
            const v = col === 1 ? row.id : col === 2 ? row.name : col === 3 ? row.dept : String(row.salary);
            return { result: v, highlight: Math.max(1, Math.min(4, Math.round(r))) - 1 };
          }
          case "CHOOSE": {
            const i = Math.round(idx) || 1;
            const list = ["苹果", "香蕉", "橙子"];
            if (i < 1 || i > list.length) return { error: "序号超出范围" };
            return { result: list[i - 1] };
          }
          default:
            return { result: "—" };
        }
      }
      case "date": {
        const y = num(fields, vals, "y");
        const m = num(fields, vals, "m");
        const d = num(fields, vals, "d");
        const today = new Date();
        const pad = (x: number) => String(x).padStart(2, "0");
        const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        const make = () => {
          if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
            return { error: "请输入完整日期" };
          const dt = new Date(Math.round(y), Math.round(m) - 1, Math.round(d));
          if (dt.getFullYear() !== Math.round(y) || dt.getMonth() !== Math.round(m) - 1)
            return { error: "无效日期" };
          return { result: fmt(dt), date: dt };
        };
        switch (name) {
          case "TODAY": {
            const f = (n: number) => {
              const t = new Date(today);
              t.setDate(t.getDate() + n);
              return fmt(t);
            };
            return { result: `${fmt(today)}（7 天后：${f(7)}，30 天后：${f(30)}）` };
          }
          case "NOW":
            return { result: `${fmt(today)} ${pad(today.getHours())}:${pad(today.getMinutes())}` };
          case "DATE": {
            const r = make();
            return r;
          }
          case "YEAR": {
            const r = make();
            return r.date ? { result: String(r.date.getFullYear()) } : r;
          }
          case "MONTH": {
            const r = make();
            return r.date ? { result: String(r.date.getMonth() + 1) } : r;
          }
          case "DAY": {
            const r = make();
            return r.date ? { result: String(r.date.getDate()) } : r;
          }
          case "WEEKDAY": {
            const r = make();
            if (!r.date) return r;
            const wd = r.date.getDay() === 0 ? 7 : r.date.getDay(); // 周一=1 … 周日=7
            return { result: `${wd}（星期${"一二三四五六日"[wd - 1]}）` };
          }
          case "DATEDIF": {
            if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
              return { error: "请输入完整起始日期" };
            const start = new Date(Math.round(y), Math.round(m) - 1, Math.round(d));
            const days = Math.floor((today.getTime() - start.getTime()) / 86400000);
            if (days < 0) return { error: "结束日期须晚于起始日期" };
            const years = Math.max(0, today.getFullYear() - start.getFullYear());
            return { result: `整年 ${years} 年 · 天数 ${days} 天` };
          }
          default:
            return { result: "—" };
        }
      }
      case "stats": {
        const op = txt(fields, vals, "op");
        const k = num(fields, vals, "k");
        const score = num(fields, vals, "score");
        switch (name) {
          case "MEDIAN": {
            const s = [...SCORES].sort((a, b) => a - b);
            return { result: String(s[Math.floor(s.length / 2)]) };
          }
          case "LARGE": {
            const kk = Math.round(k) || 1;
            const s = [...SCORES].sort((a, b) => b - a);
            return { result: String(s[Math.min(kk, s.length) - 1] ?? "—") };
          }
          case "SMALL": {
            const kk = Math.round(k) || 1;
            const s = [...SCORES].sort((a, b) => a - b);
            return { result: String(s[Math.min(kk, s.length) - 1] ?? "—") };
          }
          case "RANK": {
            if (!Number.isFinite(score)) return { error: "请输入分数" };
            const s = [...SCORES].sort((a, b) => b - a);
            return { result: String(s.indexOf(score) + 1 || "—") };
          }
          case "COUNTIF": {
            if (op === "gte60") return { result: String(SCORES.filter((x) => x >= 60).length) };
            if (op === "lt60") return { result: String(SCORES.filter((x) => x < 60).length) };
            return { result: String(SCORES.filter((x) => x === 90).length) };
          }
          case "SUMIF": {
            if (op === "gte60")
              return { result: String(SCORES.filter((x) => x >= 60).reduce((a, b) => a + b, 0)) };
            return { result: String(SCORES.filter((x) => x < 60).reduce((a, b) => a + b, 0)) };
          }
          default:
            return { result: "—" };
        }
      }
      default:
        return { result: "—" };
    }
  } catch {
    return { error: "计算出错" };
  }
}

/** ROUND：四舍五入到指定位数（负数位=十位/百位） */
function roundHalfUp(n: number, digits: number): number {
  const f = 10 ** Math.round(digits);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** ROUNDUP / ROUNDDOWN：远离/朝向零 */
function roundAway(n: number, digits: number, up: boolean): number {
  const f = 10 ** Math.round(digits);
  const x = n * f;
  return (up ? (x >= 0 ? Math.ceil(x) : Math.floor(x)) : x >= 0 ? Math.floor(x) : Math.ceil(x)) / f;
}

/** TRUNC：直接截断 */
function trunc(n: number, digits: number): number {
  const f = 10 ** Math.round(digits);
  return Math.trunc(n * f) / f;
}

function renderField(
  f: DemoField,
  val: string | number,
  set: (v: string | number) => void,
  i: number,
) {
  if (f.kind === "select") {
    return (
      <label className="ex-demo-field" key={f.key}>
        <span className="ex-demo-label">{f.label}</span>
        <select
          className="input"
          value={String(val)}
          onChange={(e) => set(e.target.value)}
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (f.kind === "number") {
    return (
      <label className="ex-demo-field" key={f.key}>
        <span className="ex-demo-label">{f.label}</span>
        <input
          className="input"
          type="number"
          value={val}
          onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </label>
    );
  }
  return (
    <label className="ex-demo-field" key={f.key}>
      <span className="ex-demo-label">{f.label}</span>
      <input
        className="input"
        type="text"
        value={val}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}

export function ExcelDemo({ fn }: { fn: ExcelFn }) {
  const demo = fn.demo;
  const fields = demo?.fields ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const f of fields) init[f.key] = f.kind === "number" ? f.def : f.def;
    return init;
  });

  const out = useMemo(() => compute(fn, fields, vals), [fn, fields, vals]);

  const showStaffTable = demo?.kind === "lookup" && fn.name !== "CHOOSE";
  const showScoreRow = demo?.kind === "stats";

  return (
    <div className="panel ex-demo">
      <div className="panel-head">
        <span className="label">交互模拟</span>
        {demo?.hint && <span className="right subtle">{demo.hint}</span>}
      </div>
      <div className="ex-demo-body">
        {fields.length > 0 && (
          <div className="ex-demo-fields">
            {fields.map((f, i) =>
              renderField(f, vals[f.key] ?? f.def, (v) => setVals((p) => ({ ...p, [f.key]: v })), i),
            )}
          </div>
        )}

        {showScoreRow && (
          <div className="ex-mini-table">
            <div className="ex-mini-head">模拟数据（成绩）</div>
            <div className="ex-mini-row">
              {SCORES.map((s) => (
                <span className="ex-mini-cell" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {showStaffTable && (
          <div className="ex-mini-table">
            <div className="ex-mini-head">模拟数据（员工表）</div>
            <table className="ex-staff">
              <thead>
                <tr>
                  <th>工号</th>
                  <th>姓名</th>
                  <th>部门</th>
                  <th>月薪</th>
                </tr>
              </thead>
              <tbody>
                {STAFF.map((r, i) => (
                  <tr
                    key={r.id}
                    className={out && "highlight" in out && out.highlight === i ? "hit" : ""}
                  >
                    <td className="mono">{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.dept}</td>
                    <td className="mono">{r.salary.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ex-demo-result">
          <span className="ex-demo-formula">
            ={fn.name}(
            {fields
              .map((f) => (f.kind === "select" || f.kind === "number" ? vals[f.key] : `"${vals[f.key]}"`))
              .join(", ")}
            )
          </span>
          <IconArrowRight />
          <span className={out && "error" in out ? "ex-demo-out err" : "ex-demo-out"}>
            {out && "error" in out ? out.error : out && "result" in out ? out.result : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
