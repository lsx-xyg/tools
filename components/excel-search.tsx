"use client";

import { useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconSearch, IconStar } from "./icons";
import {
  EXCEL_CATEGORIES,
  EXCEL_FUNCTIONS,
  type ExcelFn,
  type FnCategory,
} from "@/lib/excel-functions";

const CAT_LABEL: Record<FnCategory, string> = {
  常用: "常用函数",
  数学与三角: "数学与三角",
  统计: "统计",
  文本: "文本",
  逻辑: "逻辑",
  日期与时间: "日期与时间",
  查找与引用: "查找与引用",
};

/** 函数列表：搜索 + 分类分组 + 常用置顶（全部在客户端完成） */
export function ExcelList() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const match = (f: ExcelFn) =>
    !query ||
    f.name.toLowerCase().includes(query) ||
    f.summary.toLowerCase().includes(query);

  const popular = EXCEL_FUNCTIONS.filter((f) => f.popular && match(f));
  const anyHit = EXCEL_FUNCTIONS.some(match);

  return (
    <div>
      <div className="ex-search-wrap">
        <IconSearch width={16} height={16} className="ex-search-ico" />
        <input
          className="input ex-search"
          placeholder="搜索函数名或简介，如 SUM / 查找…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="ex-list">
        {popular.length > 0 && <FnGroup label={CAT_LABEL["常用"]} fns={popular} />}
        {EXCEL_CATEGORIES.filter((c) => c !== "常用").map((cat) => {
          const fns = EXCEL_FUNCTIONS.filter((f) => f.category === cat && match(f));
          if (fns.length === 0) return null;
          return <FnGroup label={CAT_LABEL[cat]} fns={fns} key={cat} />;
        })}
        {!anyHit && <div className="ex-empty">没有匹配的函数，换个关键词试试</div>}
      </div>
    </div>
  );
}

function FnGroup({ label, fns }: { label: string; fns: ExcelFn[] }) {
  return (
    <section className="ex-group">
      <h2 className="ex-group-title">
        {label}
        <span className="ex-group-count">{fns.length}</span>
      </h2>
      <div className="ex-grid">
        {fns.map((f) => (
          <Link href={`/tools/excel-functions/${f.slug}`} className="ex-card" key={f.slug}>
            <div className="ex-card-top">
              <span className="ex-card-name mono">{f.name}</span>
              {f.popular && <IconStar width={13} height={13} className="ex-star" />}
            </div>
            <p className="ex-card-summary">{f.summary}</p>
            <span className="ex-card-syntax mono">{f.syntax}</span>
            <IconChevronRight width={14} height={14} className="ex-card-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}
