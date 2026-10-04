import type { Metadata } from "next";
import { ToolHead } from "@/components/tool-head";
import { ExcelList } from "@/components/excel-search";

export const metadata: Metadata = {
  title: "Excel 函数快查",
  description: "常用 Excel 函数列表与速查，点击查看用法、参数、示例与交互模拟。",
};

export default function ExcelFunctionsPage() {
  return (
    <div className="fade-rise">
      <ToolHead
        title="Excel 函数快查"
        lede="63 个常用函数：语法、参数、示例与交互模拟"
        chip="T-37"
      />

      <ExcelList />

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="label">说明</span>
        </div>
        <p className="ex-note">
          点击任意函数卡片可查看完整用法、参数说明、示例与可交互的迷你模拟器。
          常用函数带 ⭐ 标识并排在最前，其余按分类排列。
        </p>
      </div>
    </div>
  );
}
