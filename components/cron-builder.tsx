"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CronExpressionParser } from "cron-parser";
import { IconX } from "./icons";

const noopSubscribe = () => () => {};

type Mode = "any" | "step" | "list";
type FieldKey = "minute" | "hour" | "day" | "month" | "week";

interface Field {
  label: string;
  range: string;
  mode: Mode;
  val: string;
  placeholder: string;
}

const FIELDS_INIT: Record<FieldKey, Field> = {
  minute: { label: "分", range: "0–59", mode: "step", val: "5", placeholder: "如 5 / 0,15,30" },
  hour: { label: "时", range: "0–23", mode: "any", val: "", placeholder: "如 8" },
  day: { label: "日", range: "1–31", mode: "any", val: "", placeholder: "如 15" },
  month: { label: "月", range: "1–12", mode: "any", val: "", placeholder: "如 6" },
  week: { label: "周", range: "0–7 · 0/7=周日", mode: "any", val: "", placeholder: "如 1（周一）" },
};

const PRESETS: { name: string; expr: string }[] = [
  { name: "每分钟", expr: "* * * * *" },
  { name: "每小时", expr: "0 * * * *" },
  { name: "每天 0 点", expr: "0 0 * * *" },
  { name: "每周一 9 点", expr: "0 9 * * 1" },
  { name: "每月 1 号", expr: "0 0 1 * *" },
  { name: "每年元旦", expr: "0 0 1 1 *" },
];

/** 把 5 段表达式拆回各字段 */
function splitExpr(expr: string): Record<FieldKey, { mode: Mode; val: string }> {
  const parts = expr.trim().split(/\s+/).slice(-5);
  const keys: FieldKey[] = ["minute", "hour", "day", "month", "week"];
  const out = {} as Record<FieldKey, { mode: Mode; val: string }>;
  keys.forEach((k, i) => {
    const p = parts[i] ?? "*";
    if (p === "*") out[k] = { mode: "any", val: "" };
    else if (p.startsWith("*/")) out[k] = { mode: "step", val: p.slice(2) };
    else out[k] = { mode: "list", val: p };
  });
  return out;
}

export function CronBuilder({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onApply: (expr: string) => void;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [fields, setFields] = useState<Record<FieldKey, Field>>(() => {
    const split = splitExpr(initial || "*/5 * * * *");
    return {
      minute: { ...FIELDS_INIT.minute, ...split.minute },
      hour: { ...FIELDS_INIT.hour, ...split.hour },
      day: { ...FIELDS_INIT.day, ...split.day },
      month: { ...FIELDS_INIT.month, ...split.month },
      week: { ...FIELDS_INIT.week, ...split.week },
    };
  });
  const [err, setErr] = useState("");

  const expr = useMemo(() => {
    const parts = (["minute", "hour", "day", "month", "week"] as FieldKey[]).map((k) => {
      const f = fields[k];
      if (f.mode === "any") return "*";
      if (f.mode === "step") {
        const n = f.val.trim();
        return n ? `*/${n}` : "*";
      }
      return f.val.trim() || "*";
    });
    return parts.join(" ");
  }, [fields]);

  function setField(key: FieldKey, patch: Partial<Field>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setErr("");
  }

  function applyPreset(p: string) {
    const split = splitExpr(p);
    const keys: FieldKey[] = ["minute", "hour", "day", "month", "week"];
    setFields((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = { ...prev[k], ...split[k] };
      });
      return next;
    });
    setErr("");
  }

  function apply() {
    try {
      CronExpressionParser.parse(expr);
      onApply(expr);
      onClose();
    } catch {
      setErr("组合无效：请检查取值是否在范围内（分 0–59、时 0–23、日 1–31、月 1–12、周 0–7）");
    }
  }

  if (!isClient) return null;
  if (!open) return null;

  const node = (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal modal-pop cron-builder"
        role="dialog"
        aria-modal="true"
        aria-label="Cron 可视化生成"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="label">
            <span className="lamp ok" aria-hidden="true" />
            Cron 可视化生成
          </span>
          <button className="btn btn-quiet btn-icon" onClick={onClose} type="button" aria-label="关闭">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="cb-presets" role="group" aria-label="快速预设">
          {PRESETS.map((p) => (
            <button key={p.expr} className="cron-example" onClick={() => applyPreset(p.expr)} type="button">
              {p.name}
              <code>{p.expr}</code>
            </button>
          ))}
        </div>

        <div className="cb-rows">
          {(Object.keys(fields) as FieldKey[]).map((key) => {
            const f = fields[key];
            return (
              <div className="cb-row" key={key}>
                <span className="cb-label">{f.label}</span>
                <div className="seg" role="group" aria-label={`${f.label} 模式`}>
                  <button data-active={f.mode === "any"} onClick={() => setField(key, { mode: "any" })} type="button">
                    任意
                  </button>
                  <button data-active={f.mode === "step"} onClick={() => setField(key, { mode: "step" })} type="button">
                    每
                  </button>
                  <button data-active={f.mode === "list"} onClick={() => setField(key, { mode: "list" })} type="button">
                    指定
                  </button>
                </div>
                {f.mode !== "any" && (
                  <input
                    className="input cb-input"
                    value={f.val}
                    onChange={(e) => setField(key, { val: e.target.value })}
                    placeholder={f.placeholder}
                    inputMode={f.mode === "step" ? "numeric" : "text"}
                    aria-label={`${f.label} 值`}
                  />
                )}
                <span className="cb-range">{f.range}</span>
              </div>
            );
          })}
        </div>

        {err && <p className="count-hint warn" style={{ marginBottom: 10 }}>{err}</p>}
        <p className="count-hint" style={{ marginBottom: 10 }}>
          标准 Cron 不含「年」字段：每年执行请指定月 + 日（如「每年元旦」= 0 0 1 1 *）
        </p>

        <div className="cb-foot">
          <span className="cb-preview" aria-label="生成的表达式">
            {expr}
          </span>
          <button className="btn btn-primary" onClick={apply} type="button">
            生成表达式
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
