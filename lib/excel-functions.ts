/**
 * Excel 函数快查 —— 内置函数库
 * 结构：列表页展示 name/summary/category/popular；
 * 详情页展示 syntax/params/examples，并附带可交互的迷你模拟器（demo）。
 */

export type FnCategory =
  | "常用"
  | "数学与三角"
  | "统计"
  | "文本"
  | "逻辑"
  | "日期与时间"
  | "查找与引用";

export type DemoField =
  | { kind: "number"; key: string; label: string; def: number }
  | { kind: "text"; key: string; label: string; def: string }
  | {
      kind: "select";
      key: string;
      label: string;
      options: { value: string; label: string }[];
      def: string;
    };

export type DemoKind =
  | "calc" // SUM / AVERAGE / COUNT / MAX / MIN：一组数字 → 结果
  | "math1" // 单数字函数：ABS / INT / SQRT / ROUNDUP / ROUNDDOWN / TRUNC / POWER / MOD / ROUND
  | "text" // 文本函数：LEFT / RIGHT / MID / LEN / TRIM / UPPER / LOWER / PROPER / SUBSTITUTE / REPLACE / FIND / CONCATENATE
  | "logical" // IF / AND / OR / NOT / IFERROR / IFS
  | "lookup" // VLOOKUP / HLOOKUP / XLOOKUP / INDEX / MATCH / CHOOSE：内置模拟表
  | "date" // TODAY / NOW / DATE / YEAR / MONTH / DAY / WEEKDAY / EOMONTH / DATEDIF
  | "stats"; // COUNTIF / COUNTIFS / SUMIF / AVERAGEIF / MEDIAN / STDEV / LARGE / SMALL / RANK：一组数字

export interface ExcelFn {
  slug: string;
  name: string;
  category: FnCategory;
  /** 常用函数置顶 */
  popular?: boolean;
  summary: string;
  syntax: string;
  params: { name: string; desc: string; optional?: boolean }[];
  examples: { title: string; input: string; result: string; note?: string }[];
  demo?: { kind: DemoKind; fields: DemoField[]; hint?: string };
}

export const EXCEL_FUNCTIONS: ExcelFn[] = [
  // ================= 常用（置顶） =================
  {
    slug: "sum",
    name: "SUM",
    category: "常用",
    popular: true,
    summary: "求一组数值的和，最常用的汇总函数。",
    syntax: "SUM(number1, [number2], …)",
    params: [
      { name: "number1", desc: "必填。要相加的第一个数值或单元格区域，如 A1:A10。" },
      { name: "number2", desc: "可选。要相加的后续数值或区域，最多 255 个。" },
    ],
    examples: [
      { title: "简单求和", input: '=SUM(A1:A5)，A1:A5 为 1,2,3,4,5', result: "15" },
      { title: "多区域相加", input: '=SUM(A1:A3, C1:C3)', result: "两个区域所有值之和" },
    ],
    demo: { kind: "calc", fields: [{ kind: "number", key: "n1", label: "数值 1", def: 12 }, { kind: "number", key: "n2", label: "数值 2", def: 25 }, { kind: "number", key: "n3", label: "数值 3", def: 8 }, { kind: "number", key: "n4", label: "数值 4", def: 5 }], hint: "输入几个数值，实时查看 SUM 的结果。" },
  },
  {
    slug: "average",
    name: "AVERAGE",
    category: "常用",
    popular: true,
    summary: "求一组数值的平均值（算术平均）。",
    syntax: "AVERAGE(number1, [number2], …)",
    params: [
      { name: "number1", desc: "必填。要计算平均值的第一个数值或区域。" },
      { name: "number2", desc: "可选。后续数值或区域。" },
    ],
    examples: [
      { title: "求平均分", input: "=AVERAGE(B2:B6)，成绩 80,90,70,85,95", result: "84" },
    ],
    demo: { kind: "calc", fields: [{ kind: "number", key: "n1", label: "数值 1", def: 80 }, { kind: "number", key: "n2", label: "数值 2", def: 90 }, { kind: "number", key: "n3", label: "数值 3", def: 70 }, { kind: "number", key: "n4", label: "数值 4", def: 85 }, { kind: "number", key: "n5", label: "数值 5", def: 95 }], hint: "AVERAGE 忽略空白与文本。" },
  },
  {
    slug: "count",
    name: "COUNT",
    category: "常用",
    popular: true,
    summary: "统计区域中包含数字的单元格个数。",
    syntax: "COUNT(value1, [value2], …)",
    params: [
      { name: "value1", desc: "必填。要计数的第一个值或区域。" },
      { name: "value2", desc: "可选。后续值或区域。" },
    ],
    examples: [
      { title: "统计数字个数", input: "=COUNT(A1:A6)，A1:A6 为 3,5,文本,7,8,空白", result: "4" },
    ],
    demo: { kind: "calc", fields: [{ kind: "number", key: "n1", label: "数值 1", def: 3 }, { kind: "number", key: "n2", label: "数值 2", def: 5 }, { kind: "number", key: "n3", label: "数值 3", def: 7 }, { kind: "number", key: "n4", label: "数值 4", def: 8 }], hint: "COUNT 只统计数字。" },
  },
  {
    slug: "if",
    name: "IF",
    category: "常用",
    popular: true,
    summary: "根据条件返回不同结果，Excel 中最常用的逻辑函数。",
    syntax: "IF(logical_test, value_if_true, [value_if_false])",
    params: [
      { name: "logical_test", desc: "必填。要判断的条件，如 A1>=60。" },
      { name: "value_if_true", desc: "必填。条件成立时返回的值。" },
      { name: "value_if_false", desc: "可选。条件不成立时返回的值，缺省为 FALSE。" },
    ],
    examples: [
      { title: "及格判断", input: "=IF(A1>=60,\"及格\",\"不及格\")", result: "A1=72 → 及格" },
      { title: "嵌套判断", input: '=IF(A1>=90,"优",IF(A1>=60,"良","差"))', result: "A1=85 → 良" },
    ],
    demo: { kind: "logical", fields: [{ kind: "number", key: "score", label: "分数", def: 85 }], hint: "输入一个分数，IF 实时判断等级。" },
  },
  {
    slug: "vlookup",
    name: "VLOOKUP",
    category: "常用",
    popular: true,
    summary: "在表格第一列查找值，返回同一行指定列的内容（垂直查找）。",
    syntax: "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])",
    params: [
      { name: "lookup_value", desc: "必填。要查找的值。" },
      { name: "table_array", desc: "必填。查找区域，第一列必须是查找列。" },
      { name: "col_index_num", desc: "必填。返回区域中第几列的值（从 1 开始）。" },
      { name: "range_lookup", desc: "可选。FALSE=精确匹配（推荐），TRUE=近似匹配。" },
    ],
    examples: [
      { title: "按工号查姓名", input: '=VLOOKUP("E03", A2:B5, 2, FALSE)', result: "返回 E03 对应的姓名" },
      { title: "精确匹配防错", input: '=IFERROR(VLOOKUP(E2,A2:B5,2,FALSE),"未找到")', result: "查不到时返回提示" },
    ],
    demo: { kind: "lookup", fields: [{ kind: "text", key: "lookup", label: "查找值", def: "E03" }, { kind: "select", key: "col", label: "返回列", options: [{ value: "2", label: "姓名（第 2 列）" }, { value: "3", label: "部门（第 3 列）" }, { value: "4", label: "月薪（第 4 列）" }], def: "2" }], hint: "在下表第一列（工号）中精确查找，实时高亮命中行。" },
  },
  {
    slug: "countif",
    name: "COUNTIF",
    category: "常用",
    popular: true,
    summary: "统计区域中满足给定条件的单元格个数。",
    syntax: "COUNTIF(range, criteria)",
    params: [
      { name: "range", desc: "必填。要统计的区域。" },
      { name: "criteria", desc: "必填。条件，支持 >60、\"苹果\"、\"A*\" 等。" },
    ],
    examples: [
      { title: "统计及格人数", input: '=COUNTIF(A1:A10,">=60")', result: "≥60 的个数" },
      { title: "统计指定文本", input: '=COUNTIF(B1:B10,"苹果")', result: "苹果出现的次数" },
    ],
    demo: { kind: "stats", fields: [{ kind: "select", key: "op", label: "条件", options: [{ value: "gte60", label: "≥ 60" }, { value: "lt60", label: "< 60" }, { value: "eq90", label: "= 90" }], def: "gte60" }], hint: "对下面这组成绩统计满足条件的个数。" },
  },
  {
    slug: "sumif",
    name: "SUMIF",
    category: "常用",
    popular: true,
    summary: "按条件对区域求和。",
    syntax: "SUMIF(range, criteria, [sum_range])",
    params: [
      { name: "range", desc: "必填。条件判断的区域。" },
      { name: "criteria", desc: "必填。条件，如 \">50\"。" },
      { name: "sum_range", desc: "可选。实际求和的区域；缺省时对 range 求和。" },
    ],
    examples: [
      { title: "条件求和", input: '=SUMIF(A1:A5,">50")', result: ">50 的值之和" },
      { title: "双区域", input: '=SUMIF(A1:A5,"苹果",B1:B5)', result: "苹果对应的 B 列之和" },
    ],
    demo: { kind: "stats", fields: [{ kind: "select", key: "op", label: "条件", options: [{ value: "gte60", label: "≥ 60" }, { value: "lt60", label: "< 60" }], def: "gte60" }], hint: "对下面这组成绩求和。" },
  },
  {
    slug: "max",
    name: "MAX",
    category: "常用",
    popular: true,
    summary: "返回一组数值中的最大值。",
    syntax: "MAX(number1, [number2], …)",
    params: [
      { name: "number1", desc: "必填。第一个数值或区域。" },
      { name: "number2", desc: "可选。后续数值或区域。" },
    ],
    examples: [{ title: "最高分", input: "=MAX(B2:B10)", result: "区域中最大数字" }],
    demo: { kind: "calc", fields: [{ kind: "number", key: "n1", label: "数值 1", def: 56 }, { kind: "number", key: "n2", label: "数值 2", def: 89 }, { kind: "number", key: "n3", label: "数值 3", def: 72 }, { kind: "number", key: "n4", label: "数值 4", def: 95 }], hint: "输入几个数值，实时看最大值。" },
  },
  {
    slug: "min",
    name: "MIN",
    category: "常用",
    popular: true,
    summary: "返回一组数值中的最小值。",
    syntax: "MIN(number1, [number2], …)",
    params: [
      { name: "number1", desc: "必填。第一个数值或区域。" },
      { name: "number2", desc: "可选。后续数值或区域。" },
    ],
    examples: [{ title: "最低分", input: "=MIN(B2:B10)", result: "区域中最小数字" }],
    demo: { kind: "calc", fields: [{ kind: "number", key: "n1", label: "数值 1", def: 56 }, { kind: "number", key: "n2", label: "数值 2", def: 89 }, { kind: "number", key: "n3", label: "数值 3", def: 72 }, { kind: "number", key: "n4", label: "数值 4", def: 95 }], hint: "输入几个数值，实时看最小值。" },
  },
  {
    slug: "left",
    name: "LEFT",
    category: "常用",
    popular: true,
    summary: "从文本左侧提取指定数量的字符。",
    syntax: "LEFT(text, [num_chars])",
    params: [
      { name: "text", desc: "必填。要提取的文本或单元格。" },
      { name: "num_chars", desc: "可选。提取字符数，缺省为 1。" },
    ],
    examples: [
      { title: "提取前 3 位", input: '=LEFT("2026-09-30", 4)', result: "2026" },
      { title: "缺省取 1 位", input: '=LEFT("苹果")', result: "苹" },
    ],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "2026-09-30" }, { kind: "number", key: "n", label: "提取字符数", def: 4 }], hint: "实时查看从左侧提取的结果。" },
  },
  {
    slug: "right",
    name: "RIGHT",
    category: "常用",
    popular: true,
    summary: "从文本右侧提取指定数量的字符。",
    syntax: "RIGHT(text, [num_chars])",
    params: [
      { name: "text", desc: "必填。要提取的文本或单元格。" },
      { name: "num_chars", desc: "可选。提取字符数，缺省为 1。" },
    ],
    examples: [
      { title: "提取日期", input: '=RIGHT("2026-09-30", 2)', result: "30" },
    ],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "2026-09-30" }, { kind: "number", key: "n", label: "提取字符数", def: 2 }], hint: "实时查看从右侧提取的结果。" },
  },
  {
    slug: "round",
    name: "ROUND",
    category: "常用",
    popular: true,
    summary: "将数字四舍五入到指定位数。",
    syntax: "ROUND(number, num_digits)",
    params: [
      { name: "number", desc: "必填。要舍入的数字。" },
      { name: "num_digits", desc: "必填。小数位数；负数表示舍入到十位/百位。" },
    ],
    examples: [
      { title: "保留两位", input: "=ROUND(3.14159, 2)", result: "3.14" },
      { title: "舍入到十位", input: "=ROUND(1234, -1)", result: "1230" },
    ],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: 3.14159 }, { kind: "number", key: "d", label: "小数位数", def: 2 }], hint: "实时查看四舍五入结果。" },
  },
  {
    slug: "today",
    name: "TODAY",
    category: "常用",
    popular: true,
    summary: "返回当前日期（无参数，每次打开自动更新）。",
    syntax: "TODAY()",
    params: [{ name: "无", desc: "该函数不需要参数。" }],
    examples: [
      { title: "当前日期", input: "=TODAY()", result: "如 2026/10/5" },
      { title: "多少天后到期", input: "=TODAY()+30", result: "30 天后的日期" },
    ],
    demo: { kind: "date", fields: [], hint: "显示今天的日期，以及 7 天 / 30 天后的日期。" },
  },

  // ================= 数学与三角 =================
  {
    slug: "abs",
    name: "ABS",
    category: "数学与三角",
    summary: "返回数字的绝对值。",
    syntax: "ABS(number)",
    params: [{ name: "number", desc: "必填。要取绝对值的数字。" }],
    examples: [{ title: "负转正", input: "=ABS(-8)", result: "8" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: -8 }, { kind: "number", key: "d", label: "小数位数（忽略）", def: 0 }], hint: "输入任意数字查看绝对值。" },
  },
  {
    slug: "int",
    name: "INT",
    category: "数学与三角",
    summary: "向下取整到最接近的整数（注意负数会向更小的方向取）。",
    syntax: "INT(number)",
    params: [{ name: "number", desc: "必填。要取整的数字。" }],
    examples: [
      { title: "正数", input: "=INT(8.9)", result: "8" },
      { title: "负数", input: "=INT(-8.9)", result: "-9" },
    ],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: -8.9 }, { kind: "number", key: "d", label: "小数位数（忽略）", def: 0 }], hint: "观察向下取整行为。" },
  },
  {
    slug: "mod",
    name: "MOD",
    category: "数学与三角",
    summary: "返回两数相除的余数。",
    syntax: "MOD(number, divisor)",
    params: [
      { name: "number", desc: "必填。被除数。" },
      { name: "divisor", desc: "必填。除数，不能为 0。" },
    ],
    examples: [
      { title: "奇偶判断", input: "=MOD(7,2)", result: "1（奇数）" },
    ],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "被除数", def: 7 }, { kind: "number", key: "d", label: "除数", def: 2 }], hint: "MOD 的余数符号与除数一致。" },
  },
  {
    slug: "power",
    name: "POWER",
    category: "数学与三角",
    summary: "返回数字的乘幂结果。",
    syntax: "POWER(number, power)",
    params: [
      { name: "number", desc: "必填。底数。" },
      { name: "power", desc: "必填。指数。" },
    ],
    examples: [{ title: "平方", input: "=POWER(5,2)", result: "25" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "底数", def: 5 }, { kind: "number", key: "d", label: "指数", def: 2 }], hint: "等价于 5^2。" },
  },
  {
    slug: "sqrt",
    name: "SQRT",
    category: "数学与三角",
    summary: "返回正数的平方根。",
    syntax: "SQRT(number)",
    params: [{ name: "number", desc: "必填。要开平方的正数。" }],
    examples: [{ title: "开平方", input: "=SQRT(16)", result: "4" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: 16 }, { kind: "number", key: "d", label: "小数位数（忽略）", def: 0 }], hint: "负数会返回错误。" },
  },
  {
    slug: "roundup",
    name: "ROUNDUP",
    category: "数学与三角",
    summary: "远离零向上舍入到指定位数。",
    syntax: "ROUNDUP(number, num_digits)",
    params: [
      { name: "number", desc: "必填。要舍入的数字。" },
      { name: "num_digits", desc: "必填。小数位数。" },
    ],
    examples: [{ title: "向上取整", input: "=ROUNDUP(3.14159, 2)", result: "3.15" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: 3.14159 }, { kind: "number", key: "d", label: "小数位数", def: 2 }], hint: "永远向上舍入。" },
  },
  {
    slug: "rounddown",
    name: "ROUNDDOWN",
    category: "数学与三角",
    summary: "向零方向舍入到指定位数。",
    syntax: "ROUNDDOWN(number, num_digits)",
    params: [
      { name: "number", desc: "必填。要舍入的数字。" },
      { name: "num_digits", desc: "必填。小数位数。" },
    ],
    examples: [{ title: "向下截断", input: "=ROUNDDOWN(3.14159, 2)", result: "3.14" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: 3.14159 }, { kind: "number", key: "d", label: "小数位数", def: 2 }], hint: "永远向下舍入。" },
  },
  {
    slug: "trunc",
    name: "TRUNC",
    category: "数学与三角",
    summary: "直接截断小数部分，保留指定位数。",
    syntax: "TRUNC(number, [num_digits])",
    params: [
      { name: "number", desc: "必填。要截断的数字。" },
      { name: "num_digits", desc: "可选。保留的小数位数，缺省为 0。" },
    ],
    examples: [{ title: "截断", input: "=TRUNC(3.999)", result: "3" }],
    demo: { kind: "math1", fields: [{ kind: "number", key: "n", label: "数值", def: 3.999 }, { kind: "number", key: "d", label: "小数位数", def: 0 }], hint: "TRUNC 不四舍五入。" },
  },
  {
    slug: "rand",
    name: "RAND",
    category: "数学与三角",
    summary: "返回 0 到 1 之间的随机数（每次计算都变化）。",
    syntax: "RAND()",
    params: [{ name: "无", desc: "无参数。" }],
    examples: [
      { title: "随机 1-100", input: "=INT(RAND()*100)+1", result: "1~100 的随机整数" },
    ],
  },
  {
    slug: "pi",
    name: "PI",
    category: "数学与三角",
    summary: "返回圆周率 π（约 3.14159）。",
    syntax: "PI()",
    params: [{ name: "无", desc: "无参数。" }],
    examples: [{ title: "圆面积", input: "=PI()*5^2", result: "约 78.54" }],
  },

  // ================= 统计 =================
  {
    slug: "counta",
    name: "COUNTA",
    category: "统计",
    summary: "统计区域中非空单元格个数（数字、文本都算）。",
    syntax: "COUNTA(value1, [value2], …)",
    params: [
      { name: "value1", desc: "必填。第一个值或区域。" },
      { name: "value2", desc: "可选。后续值或区域。" },
    ],
    examples: [{ title: "非空计数", input: "=COUNTA(A1:A5)，含 3 个数字 1 个文本 1 个空白", result: "4" }],
  },
  {
    slug: "countblank",
    name: "COUNTBLANK",
    category: "统计",
    summary: "统计区域中空白单元格个数。",
    syntax: "COUNTBLANK(range)",
    params: [{ name: "range", desc: "必填。要统计的区域。" }],
    examples: [{ title: "空白计数", input: "=COUNTBLANK(A1:A10)", result: "空白单元格个数" }],
  },
  {
    slug: "averageif",
    name: "AVERAGEIF",
    category: "统计",
    summary: "按条件计算区域的平均值。",
    syntax: "AVERAGEIF(range, criteria, [average_range])",
    params: [
      { name: "range", desc: "必填。条件判断区域。" },
      { name: "criteria", desc: "必填。条件。" },
      { name: "average_range", desc: "可选。实际平均的区域。" },
    ],
    examples: [{ title: "条件平均", input: '=AVERAGEIF(A1:A5,">=60")', result: "≥60 值的平均" }],
  },
  {
    slug: "median",
    name: "MEDIAN",
    category: "统计",
    summary: "返回一组数字的中位数（中间值）。",
    syntax: "MEDIAN(number1, [number2], …)",
    params: [{ name: "number1", desc: "必填。第一个数值或区域。" }],
    examples: [{ title: "中位数", input: "=MEDIAN(1,2,3,4,100)", result: "3" }],
    demo: { kind: "stats", fields: [], hint: "对固定示例数据 1,2,3,4,100 求中位数。" },
  },
  {
    slug: "stdev",
    name: "STDEV",
    category: "统计",
    summary: "估算样本的标准差，衡量数据离散程度。",
    syntax: "STDEV(number1, [number2], …)",
    params: [{ name: "number1", desc: "必填。样本的第一个数值或区域。" }],
    examples: [{ title: "样本标准差", input: "=STDEV(A1:A10)", result: "样本标准差（用 n-1）" }],
  },
  {
    slug: "large",
    name: "LARGE",
    category: "统计",
    summary: "返回数据集中第 k 大的值。",
    syntax: "LARGE(array, k)",
    params: [
      { name: "array", desc: "必填。数值区域。" },
      { name: "k", desc: "必填。第 k 大，k=1 为最大值。" },
    ],
    examples: [{ title: "第二高分", input: "=LARGE(B2:B10, 2)", result: "第 2 大的值" }],
    demo: { kind: "stats", fields: [{ kind: "select", key: "k", label: "第几大", options: [{ value: "1", label: "第 1 大（最大）" }, { value: "2", label: "第 2 大" }, { value: "3", label: "第 3 大" }], def: "2" }], hint: "固定数据 45,72,88,91,66 中取第 k 大。" },
  },
  {
    slug: "small",
    name: "SMALL",
    category: "统计",
    summary: "返回数据集中第 k 小的值。",
    syntax: "SMALL(array, k)",
    params: [
      { name: "array", desc: "必填。数值区域。" },
      { name: "k", desc: "必填。第 k 小，k=1 为最小值。" },
    ],
    examples: [{ title: "第二低分", input: "=SMALL(B2:B10, 2)", result: "第 2 小的值" }],
    demo: { kind: "stats", fields: [{ kind: "select", key: "k", label: "第几小", options: [{ value: "1", label: "第 1 小（最小）" }, { value: "2", label: "第 2 小" }, { value: "3", label: "第 3 小" }], def: "2" }], hint: "固定数据 45,72,88,91,66 中取第 k 小。" },
  },
  {
    slug: "rank",
    name: "RANK",
    category: "统计",
    summary: "返回数字在一组数字中的排名。",
    syntax: "RANK(number, ref, [order])",
    params: [
      { name: "number", desc: "必填。要排名的数字。" },
      { name: "ref", desc: "必填。数字列表区域。" },
      { name: "order", desc: "可选。0 或省略=降序（最大排第 1），1=升序。" },
    ],
    examples: [{ title: "成绩排名", input: "=RANK(88, B2:B10, 0)", result: "88 在降序中的名次" }],
    demo: { kind: "stats", fields: [{ kind: "number", key: "score", label: "要排名的分数", def: 88 }], hint: "固定成绩 45,72,88,91,66 降序排名。" },
  },

  // ================= 文本 =================
  {
    slug: "mid",
    name: "MID",
    category: "文本",
    summary: "从文本中间指定位置开始提取指定长度字符。",
    syntax: "MID(text, start_num, num_chars)",
    params: [
      { name: "text", desc: "必填。要提取的文本。" },
      { name: "start_num", desc: "必填。起始位置（从 1 开始）。" },
      { name: "num_chars", desc: "必填。提取长度。" },
    ],
    examples: [{ title: "提取中间", input: '=MID("2026-09-30", 6, 2)', result: "09" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "2026-09-30" }, { kind: "number", key: "n", label: "起始位置", def: 6 }], hint: "从第 6 位起提取 2 个字符。" },
  },
  {
    slug: "len",
    name: "LEN",
    category: "文本",
    summary: "返回文本字符串的字符个数。",
    syntax: "LEN(text)",
    params: [{ name: "text", desc: "必填。要计算长度的文本。" }],
    examples: [{ title: "字符数", input: '=LEN("苹果 hello")', result: "8（含空格）" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "苹果 hello" }, { kind: "number", key: "n", label: "忽略", def: 0 }], hint: "实时统计字符数（空格也算）。" },
  },
  {
    slug: "trim",
    name: "TRIM",
    category: "文本",
    summary: "清除文本首尾空格，并合并中间连续多个空格。",
    syntax: "TRIM(text)",
    params: [{ name: "text", desc: "必填。要去空格的文本。" }],
    examples: [{ title: "清理空格", input: '=TRIM("  你好  世界  ")', result: "你好 世界" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "  你好  世界  " }, { kind: "number", key: "n", label: "忽略", def: 0 }], hint: "查看清理后的结果。" },
  },
  {
    slug: "upper",
    name: "UPPER",
    category: "文本",
    summary: "将文本全部转为大写。",
    syntax: "UPPER(text)",
    params: [{ name: "text", desc: "必填。要转大写的文本。" }],
    examples: [{ title: "转大写", input: '=UPPER("hello world")', result: "HELLO WORLD" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "hello world" }, { kind: "number", key: "n", label: "忽略", def: 0 }], hint: "实时转大写。" },
  },
  {
    slug: "lower",
    name: "LOWER",
    category: "文本",
    summary: "将文本全部转为小写。",
    syntax: "LOWER(text)",
    params: [{ name: "text", desc: "必填。要转小写的文本。" }],
    examples: [{ title: "转小写", input: '=LOWER("HELLO")', result: "hello" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "HELLO WORLD" }, { kind: "number", key: "n", label: "忽略", def: 0 }], hint: "实时转小写。" },
  },
  {
    slug: "proper",
    name: "PROPER",
    category: "文本",
    summary: "将每个单词首字母转为大写。",
    syntax: "PROPER(text)",
    params: [{ name: "text", desc: "必填。要转换的文本。" }],
    examples: [{ title: "首字母大写", input: '=PROPER("hello world")', result: "Hello World" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "文本", def: "hello world" }, { kind: "number", key: "n", label: "忽略", def: 0 }], hint: "实时转换。" },
  },
  {
    slug: "substitute",
    name: "SUBSTITUTE",
    category: "文本",
    summary: "将文本中指定的子串替换为新的内容（可指定第几次出现）。",
    syntax: "SUBSTITUTE(text, old_text, new_text, [instance_num])",
    params: [
      { name: "text", desc: "必填。原文本。" },
      { name: "old_text", desc: "必填。要被替换的旧文本。" },
      { name: "new_text", desc: "必填。替换成的新文本。" },
      { name: "instance_num", desc: "可选。只替换第几次出现；缺省全部替换。" },
    ],
    examples: [
      { title: "全部替换", input: '=SUBSTITUTE("a-b-c","-","/")', result: "a/b/c" },
    ],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "原文本", def: "a-b-c" }, { kind: "text", key: "old", label: "旧文本", def: "-" }, { kind: "text", key: "new", label: "新文本", def: "/" }], hint: "实时查看替换结果。" },
  },
  {
    slug: "replace",
    name: "REPLACE",
    category: "文本",
    summary: "按位置替换文本中指定长度的部分。",
    syntax: "REPLACE(old_text, start_num, num_chars, new_text)",
    params: [
      { name: "old_text", desc: "必填。原文本。" },
      { name: "start_num", desc: "必填。替换起始位置。" },
      { name: "num_chars", desc: "必填。替换掉的字符数。" },
      { name: "new_text", desc: "必填。插入的新文本。" },
    ],
    examples: [{ title: "掩码手机号", input: '=REPLACE("13812345678", 4, 4, "****")', result: "138****5678" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "原文本", def: "13812345678" }, { kind: "number", key: "start", label: "起始位置", def: 4 }, { kind: "number", key: "len", label: "替换长度", def: 4 }, { kind: "text", key: "new", label: "新文本", def: "****" }], hint: "经典手机号脱敏写法。" },
  },
  {
    slug: "find",
    name: "FIND",
    category: "文本",
    summary: "查找子串在文本中的起始位置（区分大小写）。",
    syntax: "FIND(find_text, within_text, [start_num])",
    params: [
      { name: "find_text", desc: "必填。要查找的文本。" },
      { name: "within_text", desc: "必填。在其中查找的文本。" },
      { name: "start_num", desc: "可选。从第几个字符开始找。" },
    ],
    examples: [{ title: "找位置", input: '=FIND("w","hello world")', result: "7" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "s", label: "原文本", def: "hello world" }, { kind: "text", key: "needle", label: "查找", def: "world" }], hint: "返回首次出现的位置（找不到报错）。" },
  },
  {
    slug: "concatenate",
    name: "CONCATENATE",
    category: "文本",
    summary: "将多个文本连接成一个（新版本可用 & 或 CONCAT 替代）。",
    syntax: "CONCATENATE(text1, [text2], …)",
    params: [
      { name: "text1", desc: "必填。第一个文本。" },
      { name: "text2", desc: "可选。后续要连接的文本。" },
    ],
    examples: [{ title: "连接姓名", input: '=CONCATENATE(A1,"-",B1)', result: "张三-001" }],
    demo: { kind: "text", fields: [{ kind: "text", key: "a", label: "文本 A", def: "张三" }, { kind: "text", key: "b", label: "文本 B", def: "001" }], hint: "用 - 连接两段文本。" },
  },
  {
    slug: "text",
    name: "TEXT",
    category: "文本",
    summary: "按指定格式将数字格式化为文本。",
    syntax: "TEXT(value, format_text)",
    params: [
      { name: "value", desc: "必填。要格式化的数值。" },
      { name: "format_text", desc: "必填。格式代码，如 0.00 / yyyy-mm-dd。" },
    ],
    examples: [
      { title: "金额千分位", input: '=TEXT(1234567.8,"#,##0.00")', result: "1,234,567.80" },
      { title: "日期格式化", input: '=TEXT(A1,"yyyy-mm-dd")', result: "如 2026-10-05" },
    ],
  },
  {
    slug: "value",
    name: "VALUE",
    category: "文本",
    summary: "将看起来像数字的文本转为真正的数值。",
    syntax: "VALUE(text)",
    params: [{ name: "text", desc: "必填。要转换的文本。" }],
    examples: [{ title: "文本转数字", input: '=VALUE("1,234")', result: "1234（可参与计算）" }],
  },

  // ================= 逻辑 =================
  {
    slug: "iferror",
    name: "IFERROR",
    category: "逻辑",
    summary: "公式出错时返回指定值，否则返回公式结果。",
    syntax: "IFERROR(value, value_if_error)",
    params: [
      { name: "value", desc: "必填。要检查的公式或值。" },
      { name: "value_if_error", desc: "必填。出错时返回的内容。" },
    ],
    examples: [
      { title: "除法防错", input: '=IFERROR(1/0,"除数不能为 0")', result: "除数不能为 0" },
    ],
    demo: { kind: "logical", fields: [{ kind: "number", key: "den", label: "除数", def: 0 }], hint: "除数为 0 时返回提示，否则返回商。" },
  },
  {
    slug: "and",
    name: "AND",
    category: "逻辑",
    summary: "所有条件都成立时返回 TRUE。",
    syntax: "AND(logical1, [logical2], …)",
    params: [
      { name: "logical1", desc: "必填。第一个条件。" },
      { name: "logical2", desc: "可选。后续条件。" },
    ],
    examples: [{ title: "双条件", input: '=AND(A1>=60,B1="通过")', result: "都成立才 TRUE" }],
    demo: { kind: "logical", fields: [{ kind: "number", key: "score", label: "分数", def: 75 }, { kind: "number", key: "att", label: "出勤率 %", def: 90 }], hint: "分数 ≥60 且出勤 ≥80% 才为 TRUE。" },
  },
  {
    slug: "or",
    name: "OR",
    category: "逻辑",
    summary: "任一条件成立时返回 TRUE。",
    syntax: "OR(logical1, [logical2], …)",
    params: [
      { name: "logical1", desc: "必填。第一个条件。" },
      { name: "logical2", desc: "可选。后续条件。" },
    ],
    examples: [{ title: "任一成立", input: '=OR(A1<60,B1="补考")', result: "任一成立即 TRUE" }],
  },
  {
    slug: "not",
    name: "NOT",
    category: "逻辑",
    summary: "反转逻辑值：TRUE 变 FALSE。",
    syntax: "NOT(logical)",
    params: [{ name: "logical", desc: "必填。要反转的条件或值。" }],
    examples: [{ title: "非空判断", input: '=NOT(ISBLANK(A1))', result: "A1 非空时 TRUE" }],
  },
  {
    slug: "ifs",
    name: "IFS",
    category: "逻辑",
    summary: "多条件判断，依次返回第一个成立条件的结果（替代多层嵌套 IF）。",
    syntax: "IFS(logical_test1, value1, [logical_test2, value2], …)",
    params: [
      { name: "logical_test1", desc: "必填。第一个条件。" },
      { name: "value1", desc: "必填。第一个条件成立时的返回值。" },
    ],
    examples: [
      { title: "成绩分级", input: '=IFS(A1>=90,"优",A1>=80,"良",A1>=60,"及格",TRUE,"不及格")', result: "按区间返回等级" },
    ],
    demo: { kind: "logical", fields: [{ kind: "number", key: "score", label: "分数", def: 85 }], hint: "IFS 依次判断：≥90 优 / ≥80 良 / ≥60 及格 / 否则不及格。" },
  },

  // ================= 日期与时间 =================
  {
    slug: "now",
    name: "NOW",
    category: "日期与时间",
    summary: "返回当前日期和时间（无参数，自动刷新）。",
    syntax: "NOW()",
    params: [{ name: "无", desc: "无参数。" }],
    examples: [{ title: "当前时间", input: "=NOW()", result: "如 2026/10/5 14:30" }],
    demo: { kind: "date", fields: [], hint: "实时显示当前日期时间。" },
  },
  {
    slug: "date",
    name: "DATE",
    category: "日期与时间",
    summary: "由年、月、日三个数字拼成一个日期。",
    syntax: "DATE(year, month, day)",
    params: [
      { name: "year", desc: "必填。年份。" },
      { name: "month", desc: "必填。月份。" },
      { name: "day", desc: "必填。日。" },
    ],
    examples: [{ title: "构造日期", input: "=DATE(2026,10,5)", result: "2026/10/5" }],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "年", def: 2026 }, { kind: "number", key: "m", label: "月", def: 10 }, { kind: "number", key: "d", label: "日", def: 5 }], hint: "输入年月日实时生成日期。" },
  },
  {
    slug: "year",
    name: "YEAR",
    category: "日期与时间",
    summary: "提取日期中的年份。",
    syntax: "YEAR(serial_number)",
    params: [{ name: "serial_number", desc: "必填。日期或日期单元格。" }],
    examples: [{ title: "取年份", input: "=YEAR(DATE(2026,10,5))", result: "2026" }],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "年", def: 2026 }, { kind: "number", key: "m", label: "月", def: 10 }, { kind: "number", key: "d", label: "日", def: 5 }], hint: "输入日期取年份。" },
  },
  {
    slug: "month",
    name: "MONTH",
    category: "日期与时间",
    summary: "提取日期中的月份。",
    syntax: "MONTH(serial_number)",
    params: [{ name: "serial_number", desc: "必填。日期或日期单元格。" }],
    examples: [{ title: "取月份", input: "=MONTH(\"2026-10-05\")", result: "10" }],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "年", def: 2026 }, { kind: "number", key: "m", label: "月", def: 10 }, { kind: "number", key: "d", label: "日", def: 5 }], hint: "输入日期取月份。" },
  },
  {
    slug: "day",
    name: "DAY",
    category: "日期与时间",
    summary: "提取日期中的日。",
    syntax: "DAY(serial_number)",
    params: [{ name: "serial_number", desc: "必填。日期或日期单元格。" }],
    examples: [{ title: "取日", input: "=DAY(\"2026-10-05\")", result: "5" }],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "年", def: 2026 }, { kind: "number", key: "m", label: "月", def: 10 }, { kind: "number", key: "d", label: "日", def: 5 }], hint: "输入日期取日。" },
  },
  {
    slug: "datedif",
    name: "DATEDIF",
    category: "日期与时间",
    summary: "计算两个日期之间的天数/月数/年数（隐藏函数但很实用）。",
    syntax: "DATEDIF(start_date, end_date, unit)",
    params: [
      { name: "start_date", desc: "必填。起始日期。" },
      { name: "end_date", desc: "必填。结束日期（须晚于起始）。" },
      { name: "unit", desc: "必填。Y=年 M=月 D=天，还有 YM/MD/Yd 变体。" },
    ],
    examples: [
      { title: "年龄（年）", input: '=DATEDIF(A1,TODAY(),"Y")', result: "整岁数" },
      { title: "相差天数", input: '=DATEDIF("2026-01-01","2026-10-05","D")', result: "277 天" },
    ],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "起始年", def: 2026 }, { kind: "number", key: "m", label: "起始月", def: 1 }, { kind: "number", key: "d", label: "起始日", def: 1 }], hint: "计算起始日期到今天的整年数 / 天数。" },
  },
  {
    slug: "weekday",
    name: "WEEKDAY",
    category: "日期与时间",
    summary: "返回日期是星期几（数字 1-7）。",
    syntax: "WEEKDAY(serial_number, [return_type])",
    params: [
      { name: "serial_number", desc: "必填。日期。" },
      { name: "return_type", desc: "可选。1=周日开头（默认），2=周一开头。" },
    ],
    examples: [{ title: "星期几", input: '=WEEKDAY("2026-10-05", 2)', result: "1（周一）" }],
    demo: { kind: "date", fields: [{ kind: "number", key: "y", label: "年", def: 2026 }, { kind: "number", key: "m", label: "月", def: 10 }, { kind: "number", key: "d", label: "日", def: 5 }], hint: "用 return_type=2 显示 1=周一 … 7=周日。" },
  },
  {
    slug: "eomonth",
    name: "EOMONTH",
    category: "日期与时间",
    summary: "返回指定月份数之前/之后那个月的最后一天。",
    syntax: "EOMONTH(start_date, months)",
    params: [
      { name: "start_date", desc: "必填。起始日期。" },
      { name: "months", desc: "必填。之前/之后的月数（负数为之前）。" },
    ],
    examples: [{ title: "本月最后一天", input: "=EOMONTH(TODAY(), 0)", result: "本月最后一天" }],
  },

  // ================= 查找与引用 =================
  {
    slug: "hlookup",
    name: "HLOOKUP",
    category: "查找与引用",
    summary: "在表格首行查找值，返回同列指定行的内容（水平查找）。",
    syntax: "HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])",
    params: [
      { name: "lookup_value", desc: "必填。要查找的值（在首行）。" },
      { name: "table_array", desc: "必填。查找区域。" },
      { name: "row_index_num", desc: "必填。返回第几行的值。" },
      { name: "range_lookup", desc: "可选。FALSE=精确匹配。" },
    ],
    examples: [{ title: "横向查找", input: '=HLOOKUP("Q3", A1:D2, 2, FALSE)', result: "Q3 对应第 2 行的值" }],
  },
  {
    slug: "index",
    name: "INDEX",
    category: "查找与引用",
    summary: "按行列号返回区域中对应位置的值。",
    syntax: "INDEX(array, row_num, [column_num])",
    params: [
      { name: "array", desc: "必填。区域。" },
      { name: "row_num", desc: "必填。行号（从 1 开始）。" },
      { name: "column_num", desc: "可选。列号，缺省返回整行。" },
    ],
    examples: [{ title: "取指定格", input: "=INDEX(A1:C5, 3, 2)", result: "第 3 行第 2 列的值" }],
    demo: { kind: "lookup", fields: [{ kind: "select", key: "row", label: "行", options: [{ value: "1", label: "第 1 行" }, { value: "2", label: "第 2 行" }, { value: "3", label: "第 3 行" }], def: "2" }, { kind: "select", key: "col", label: "列", options: [{ value: "1", label: "第 1 列（工号）" }, { value: "2", label: "第 2 列（姓名）" }, { value: "3", label: "第 3 列（部门）" }], def: "2" }], hint: "按行、列取模拟表中的值。" },
  },
  {
    slug: "match",
    name: "MATCH",
    category: "查找与引用",
    summary: "返回查找值在区域中的相对位置（行号/列号）。",
    syntax: "MATCH(lookup_value, lookup_array, [match_type])",
    params: [
      { name: "lookup_value", desc: "必填。要查找的值。" },
      { name: "lookup_array", desc: "必填。要查找的区域。" },
      { name: "match_type", desc: "可选。0=精确匹配，1=小于等于，-1=大于等于。" },
    ],
    examples: [{ title: "找位置", input: '=MATCH("E03", A1:A5, 0)', result: "3（第 3 行）" }],
    demo: { kind: "lookup", fields: [{ kind: "text", key: "lookup", label: "查找值（工号）", def: "E03" }], hint: "返回工号在表第一列中的行号。" },
  },
  {
    slug: "xlookup",
    name: "XLOOKUP",
    category: "查找与引用",
    summary: "新一代查找函数：支持任意方向、找不到返回自定义值。",
    syntax: "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], …)",
    params: [
      { name: "lookup_value", desc: "必填。要查找的值。" },
      { name: "lookup_array", desc: "必填。查找区域（不要求在第一列）。" },
      { name: "return_array", desc: "必填。返回区域。" },
      { name: "if_not_found", desc: "可选。找不到时的返回值。" },
    ],
    examples: [{ title: "反向查找", input: '=XLOOKUP("张三", B2:B5, A2:A5, "未找到")', result: "张三对应的工号" }],
    demo: { kind: "lookup", fields: [{ kind: "text", key: "lookup", label: "查找值（姓名）", def: "李四" }], hint: "按姓名（第 2 列）反查工号（第 1 列）。" },
  },
  {
    slug: "choose",
    name: "CHOOSE",
    category: "查找与引用",
    summary: "按序号从列表中选择对应值。",
    syntax: "CHOOSE(index_num, value1, [value2], …)",
    params: [
      { name: "index_num", desc: "必填。序号 1~254。" },
      { name: "value1", desc: "必填。第 1 个值。" },
    ],
    examples: [{ title: "星期名", input: '=CHOOSE(2,"一","二","三")', result: "二" }],
    demo: { kind: "lookup", fields: [{ kind: "select", key: "idx", label: "序号", options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }], def: "2" }], hint: "从「苹果 / 香蕉 / 橙子」里按序号选一个。" },
  },
  {
    slug: "indirect",
    name: "INDIRECT",
    category: "查找与引用",
    summary: "把文本形式的单元格引用变成真正的引用。",
    syntax: "INDIRECT(ref_text, [a1])",
    params: [
      { name: "ref_text", desc: "必填。如 A1、B2 或工作表名。" },
      { name: "a1", desc: "可选。TRUE=A1 样式（默认）。" },
    ],
    examples: [{ title: "动态引用", input: "=INDIRECT(\"A\"&1)", result: "等于 A1 的值" }],
  },
  {
    slug: "offset",
    name: "OFFSET",
    category: "查找与引用",
    summary: "以某单元格为基点，偏移后返回指定区域。",
    syntax: "OFFSET(reference, rows, cols, [height], [width])",
    params: [
      { name: "reference", desc: "必填。基点单元格。" },
      { name: "rows", desc: "必填。向下偏移行数（负数为向上）。" },
      { name: "cols", desc: "必填。向右偏移列数（负数为向左）。" },
      { name: "height", desc: "可选。返回区域高度。" },
      { name: "width", desc: "可选。返回区域宽度。" },
    ],
    examples: [{ title: "偏移取值", input: "=OFFSET(A1, 2, 1)", result: "B3 的值" }],
  },
];

export const EXCEL_CATEGORIES: FnCategory[] = [
  "常用",
  "数学与三角",
  "统计",
  "文本",
  "逻辑",
  "日期与时间",
  "查找与引用",
];

export function getExcelFn(slug: string): ExcelFn | undefined {
  return EXCEL_FUNCTIONS.find((f) => f.slug === slug);
}

/** 列表排序：常用置顶，其余按分类顺序保持声明顺序 */
export function sortExcelFunctions(list: ExcelFn[]): ExcelFn[] {
  return [...list].sort((a, b) => {
    if (!!a.popular !== !!b.popular) return a.popular ? -1 : 1;
    const ca = EXCEL_CATEGORIES.indexOf(a.category);
    const cb = EXCEL_CATEGORIES.indexOf(b.category);
    return ca - cb;
  });
}
