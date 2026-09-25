"use client";

import { useMemo, useState } from "react";
import { CronExpressionParser } from "cron-parser";
import { ToolHead } from "@/components/tool-head";
import { CronBuilder } from "@/components/cron-builder";
import { IconClock, IconShield, IconSliders } from "@/components/icons";

const EXAMPLES: { label: string; expr: string }[] = [
  { label: "每 5 分钟", expr: "*/5 * * * *" },
  { label: "每小时", expr: "0 * * * *" },
  { label: "每天 8:30", expr: "30 8 * * *" },
  { label: "每周一 9 点", expr: "0 9 * * 1" },
  { label: "每月 1 号 0 点", expr: "0 0 1 * *" },
  { label: "每 10 秒", expr: "*/10 * * * * *" },
];

const FIELDS = [
  { name: "分", range: "0–59", note: "*/5 = 每 5 分钟" },
  { name: "时", range: "0–23", note: "9 = 早上 9 点" },
  { name: "日", range: "1–31", note: "15 = 每月 15 号" },
  { name: "月", range: "1–12", note: "6 = 六月" },
  { name: "周", range: "0–7", note: "0 或 7 = 周日" },
];

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 周${week}`;
}

export default function CronPage() {
  const [expr, setExpr] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);

  const { times, error, fieldCount } = useMemo(() => {
    const q = expr.trim();
    if (!q) return { times: [], error: "", fieldCount: 0 };
    try {
      const expression = CronExpressionParser.parse(q, {
        currentDate: new Date(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const list: Date[] = [];
      for (let i = 0; i < 6 && expression.hasNext(); i++) {
        list.push(expression.next().toDate());
      }
      return { times: list, error: "", fieldCount: q.split(/\s+/).length };
    } catch {
      return {
        times: [],
        error: "表达式不合法：请检查字段数量（5 段：分 时 日 月 周；6 段：最前面加秒）与取值是否越界",
        fieldCount: q.split(/\s+/).length,
      };
    }
  }, [expr]);

  return (
    <div className="fade-rise">
      <ToolHead
        title="Cron 表达式"
        lede="解析下次执行时间，验证表达式是否合法"
        chip={
          <span>
            <IconShield width={12} height={12} />
            本地解析 · 不上传
          </span>
        }
      />

      <section className="panel">
        <div className="panel-head">
          <span className="label">
            <IconClock width={14} height={14} />
            表达式
          </span>
          <span className="count-hint">
            {fieldCount === 5 ? "5 段（分 时 日 月 周）" : fieldCount === 6 ? "6 段（秒 分 时 日 月 周）" : `${fieldCount} 段`}
          </span>
        </div>
        <div className="panel-body">
          <div className="input-row">
            <input
              className="input mono"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="*/5 * * * *"
              spellCheck={false}
              aria-label="Cron 表达式"
            />
            <button
              className="btn btn-ghost"
              onClick={() => setBuilderOpen(true)}
              type="button"
              title="选择年月日时分生成表达式"
            >
              <IconSliders width={14} height={14} />
              可视化生成
            </button>
            {times.length > 0 && (
              <span className="count-hint ok-chip">
                <span className="lamp ok" aria-hidden="true" />
                合法
              </span>
            )}
          </div>
          <div className="cron-examples" role="group" aria-label="常用示例">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.expr}
                className="cron-example"
                onClick={() => setExpr(ex.expr)}
                type="button"
              >
                {ex.label}
                <code>{ex.expr}</code>
              </button>
            ))}
          </div>
          {error && <p className="count-hint warn" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </section>

      <div className="cron-fields">
        {FIELDS.map((f) => (
          <div key={f.name} className="cron-field">
            <span className="cron-field-name">{f.name}</span>
            <span className="cron-field-range">{f.range}</span>
            <span className="cron-field-note">{f.note}</span>
          </div>
        ))}
        <div className="cron-field">
          <span className="cron-field-name">秒</span>
          <span className="cron-field-range">0–59</span>
          <span className="cron-field-note">仅 6 段表达式使用（可选）</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <span className="label">未来执行时间</span>
          <span className="count-hint">本地时区</span>
        </div>
        <div className="panel-body">
          {times.length === 0 ? (
            <p className="count-hint">输入合法表达式后，这里显示接下来 6 次执行时间</p>
          ) : (
            <ol className="cron-times">
              {times.map((d, i) => (
                <li key={i} className={i === 0 ? "next" : ""}>
                  <span className="cron-badge">{i === 0 ? "下次执行" : `第 ${i + 1} 次`}</span>
                  <code>{fmt(d)}</code>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <CronBuilder
        key={String(builderOpen)}
        open={builderOpen}
        initial={expr}
        onClose={() => setBuilderOpen(false)}
        onApply={(e) => setExpr(e)}
      />
    </div>
  );
}
