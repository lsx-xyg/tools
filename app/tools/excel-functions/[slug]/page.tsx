import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconStar } from "@/components/icons";
import { ExcelDemo } from "@/components/excel-demo";
import { EXCEL_FUNCTIONS, getExcelFn, type ExcelFn } from "@/lib/excel-functions";

export function generateStaticParams() {
  return EXCEL_FUNCTIONS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const fn = getExcelFn(slug);
  return {
    title: fn ? `${fn.name} - Excel 函数快查` : "Excel 函数快查",
    description: fn?.summary,
  };
}

export default async function ExcelFnDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fn = getExcelFn(slug);
  if (!fn) notFound();

  const related = EXCEL_FUNCTIONS.filter(
    (f) => f.slug !== fn.slug && f.category === fn.category,
  ).slice(0, 6);

  return (
    <div className="fade-rise">
      <div className="transfer-head">
        <Link href="/tools/excel-functions" className="back-link">
          <IconChevronLeft width={15} height={15} />
          Excel 函数快查
        </Link>
      </div>

      <div className="ex-detail-head">
        <div className="ex-detail-title">
          <h1 className="ex-detail-name mono">{fn.name}</h1>
          <span className="lede-chip">{fn.category}</span>
          {fn.popular && (
            <span className="lede-chip star">
              <IconStar width={11} height={11} /> 常用
            </span>
          )}
        </div>
        <p className="lede">{fn.summary}</p>
      </div>

      <div className="panel ex-syntax-panel">
        <div className="panel-head">
          <span className="label">语法</span>
        </div>
        <pre className="ex-syntax mono">{fn.syntax}</pre>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="label">参数说明</span>
        </div>
        <div className="table-wrap">
          <table className="ex-params">
            <thead>
              <tr>
                <th>参数</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {fn.params.map((p) => (
                <tr key={p.name + p.desc}>
                  <td className="mono">
                    {p.name}
                    {p.optional ? <em className="ex-opt">（可选）</em> : null}
                  </td>
                  <td>{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="label">示例</span>
          <span className="right subtle">输入 → 结果（操作前后对比）</span>
        </div>
        <div className="ex-examples">
          {fn.examples.map((e) => (
            <div className="ex-example" key={e.title}>
              <div className="ex-example-title">{e.title}</div>
              <div className="ex-example-io">
                <code className="ex-io-in mono">{e.input}</code>
                <IconChevronRight width={13} height={13} className="ex-io-arrow" />
                <code className="ex-io-out mono">{e.result}</code>
              </div>
              {e.note && <div className="ex-example-note">{e.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {fn.demo && <ExcelDemo fn={fn} />}

      {related.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="label">同类函数</span>
          </div>
          <div className="ex-related">
            {related.map((r: ExcelFn) => (
              <Link href={`/tools/excel-functions/${r.slug}`} className="ex-related-chip" key={r.slug}>
                <span className="mono">{r.name}</span>
                <span className="ex-related-sum">{r.summary}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
