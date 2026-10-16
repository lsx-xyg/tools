/** 工具注册表：新增工具 = 在这里加一项 + 加一个页面 */

/** 基础工具 id（第一批 20 个） */
type BaseToolId =
  | "transfer"
  | "qr"
  | "cron"
  | "convert"
  | "ts"
  | "hash"
  | "uuid"
  | "diff"
  | "regex"
  | "text"
  | "file-hash"
  | "device-info"
  | "case"
  | "mime"
  | "http-status"
  | "pdf";

/** 全部工具 id（含第二批新工具） */
export type ToolId = BaseToolId | "badge" | "markdown" | "http-parse" | "ws-test" | "vercel-clean" | "github-release-clean" | "recorder" | "ocr" | "video-convert" | "excel-functions" | "web-nav" | "print";

export interface Tool {
  id: ToolId;
  index: string; // 仪表编号，如 T-01
  name: string;
  tagline: string;
  description: string;
  path: string;
  icon:
    | "transfer"
    | "qr"
    | "cron"
    | "convert"
    | "ts"
    | "hash"
    | "uuid"
    | "diff"
    | "regex"
    | "text"
    | "file-hash"
    | "device-info"
    | "case"
    | "mime"
    | "http-status"
    | "pdf"
    | "badge"
    | "markdown"
    | "http-parse"
    | "ws-test"
    | "vercel-clean"
    | "github-release-clean"
    | "recorder"
    | "ocr"
    | "video"
    | "excel-functions"
    | "web-nav"
    | "print";
  lamp: "ok" | "amber";
  tags: string[];
  soon?: boolean;
  /** 侧边栏分组分类；缺省/未知一律归入兜底组 dev（开发与编码） */
  category?: CategoryId;
}

/** 侧边栏分组：share 传输与分享 / doc 文档处理 / text 文本处理 / dev 开发与编码 / quick 速查参考 / cicd CI/CD 与发布 / network 网络与调试 / media 媒体录制 */
export type CategoryId = "share" | "doc" | "text" | "dev" | "quick" | "cicd" | "network" | "media";

export interface NavCategory {
  id: CategoryId;
  name: string;
  /** 组图标 key，取自 icon-map 的 ICONS */
  icon: string;
}

export const NAV_CATEGORIES: NavCategory[] = [
  { id: "share", name: "传输与分享", icon: "transfer" },
  { id: "doc", name: "文档处理", icon: "markdown" },
  { id: "text", name: "文本处理", icon: "text" },
  { id: "dev", name: "开发与编码", icon: "json" },
  { id: "quick", name: "速查参考", icon: "http-status" },
  { id: "cicd", name: "CI/CD 与发布", icon: "vercel-clean" },
  { id: "network", name: "网络与调试", icon: "ws-test" },
  { id: "media", name: "媒体工具", icon: "recorder" },
];

/** 全量工具分类映射：新增工具未填 category 时默认落到 dev 兜底组 */
export const TOOL_CATEGORY: Record<ToolId, CategoryId> = {
  pdf: "doc",
  markdown: "doc",
  ocr: "doc",
  convert: "dev",
  text: "text",
  case: "text",
  diff: "text",
  recorder: "media",
  "video-convert": "media",
  "http-parse": "network",
  "http-status": "quick",
  "ws-test": "network",
  hash: "dev",
  "file-hash": "dev",
  ts: "dev",
  cron: "dev",
  uuid: "dev",
  regex: "dev",
  mime: "quick",
  "excel-functions": "quick",
  "web-nav": "quick",
  print: "doc",
  transfer: "share",
  qr: "share",
  "vercel-clean": "cicd",
  "github-release-clean": "cicd",
  badge: "dev",
  "device-info": "quick",
};

/** 工具所属分类：显式 category 优先，其次映射表，未知兜底 dev */
export function toolCategory(t: Tool): CategoryId {
  return t.category ?? TOOL_CATEGORY[t.id] ?? "dev";
}

/** 按 NAV_CATEGORIES 顺序分组的工具列表（组内按 index 排序） */
export interface ToolGroup {
  category: NavCategory;
  tools: Tool[];
}

export function groupedTools(): ToolGroup[] {
  return NAV_CATEGORIES.map((category) => ({
    category,
    tools: tools
      .filter((t) => toolCategory(t) === category.id)
      .sort((a, b) => a.index.localeCompare(b.index)),
  }));
}

export const tools: Tool[] = [
  {
    id: "transfer",
    index: "T-01",
    name: "文本 / 文件互传",
    tagline: "跨设备直传，凭提取码取回",
    description:
      "在线模式设备间点对点直传，文件不经过服务器；离线模式云端暂存，保留时长与下载次数可自定义，到期自动清除。发送文本或文件，获得 6 位提取码，另一台设备扫码或输码即可取回。",
    path: "/tools/transfer",
    icon: "transfer",
    lamp: "ok",
    tags: ["在线直传", "免登录", "到期即焚"],
  },
  {
    id: "qr",
    index: "T-02",
    name: "二维码生成 / 解析",
    tagline: "生成二维码或解析二维码图片",
    description:
      "把文本、链接、Wi-Fi 配置等任意内容生成二维码，扫码即得。可调节尺寸与颜色，一键下载 PNG。全部在本地浏览器完成，内容不经过服务器。",
    path: "/tools/qr",
    icon: "qr",
    lamp: "ok",
    tags: ["文本 / 链接", "本地生成", "下载 PNG"],
  },
  {
    id: "cron",
    index: "T-05",
    name: "Cron 表达式",
    tagline: "解析下次执行时间",
    description:
      "输入标准 Cron 表达式（支持 5 / 6 段），解析出未来多次执行时间与运行规则，验证表达式是否合法。",
    path: "/tools/cron",
    icon: "cron",
    lamp: "ok",
    tags: ["5 / 6 段", "下次执行", "本地时区"],
  },
  {
    id: "convert",
    index: "T-06",
    name: "格式互转",
    tagline: "YAML / XML / CSV / INI / TOML ↔ JSON",
    description:
      "把 YAML、XML、CSV、INI、TOML、Properties 等格式统一解析成 JSON，再输出成任意目标格式。双向互转、纯本地运行，不经过服务器。",
    path: "/tools/convert",
    icon: "convert",
    lamp: "ok",
    tags: ["YAML", "XML", "CSV", "INI", "TOML", "Properties"],
  },
  {
    id: "ts",
    index: "T-07",
    name: "时间戳转换",
    tagline: "Unix 时间 ↔ 日期时间",
    description:
      "当前时间戳实时展示；输入时间戳（自动识别秒 / 毫秒）或日期时间，双向转换，带 UTC、ISO、相对时间。",
    path: "/tools/ts",
    icon: "ts",
    lamp: "ok",
    tags: ["Unix 时间", "日期互转", "自动识别"],
  },
  {
    id: "hash",
    index: "T-08",
    name: "Hash 计算",
    tagline: "MD5 / SHA 系列 / HMAC",
    description:
      "对文本计算 MD5、SHA-1、SHA-256、SHA-512，支持 HMAC 带密钥签名。全部本地计算，一键复制任一结果。",
    path: "/tools/hash",
    icon: "hash",
    lamp: "ok",
    tags: ["MD5", "SHA-256", "HMAC"],
  },
  {
    id: "uuid",
    index: "T-09",
    name: "UUID 生成",
    tagline: "批量 v4，本地随机",
    description:
      "一次生成 1~20 个 UUID v4，支持大写 / 无横线格式，逐条或全部复制。",
    path: "/tools/uuid",
    icon: "uuid",
    lamp: "ok",
    tags: ["UUID v4", "批量", "本地随机"],
  },
  {
    id: "diff",
    index: "T-10",
    name: "文本 Diff 对比",
    tagline: "两栏对比，差异高亮",
    description:
      "粘贴原文本与新文本，行级对比差异，新增 / 删除 / 未变一目了然，带增删统计。",
    path: "/tools/diff",
    icon: "diff",
    lamp: "ok",
    tags: ["行级对比", "高亮", "增删统计"],
  },
  {
    id: "regex",
    index: "T-11",
    name: "正则测试器",
    tagline: "匹配预览与捕获组",
    description:
      "输入正则与测试文本，实时高亮所有匹配，查看起止位置与捕获组，支持 g / i / m / s 标志。",
    path: "/tools/regex",
    icon: "regex",
    lamp: "ok",
    tags: ["匹配预览", "捕获组", "标志位"],
  },
  {
    id: "text",
    index: "T-12",
    name: "文本处理合集",
    tagline: "大小写 / 排序 / 去重等",
    description:
      "转大小写、去空格、排序、去重、提取数字、反转等十余种操作，可叠加成管线依次应用。",
    path: "/tools/text",
    icon: "text",
    lamp: "ok",
    tags: ["大小写", "排序", "去重", "管线"],
  },
  {
    id: "file-hash",
    index: "T-15",
    name: "文件哈希校验",
    tagline: "本地文件的 MD5 / SHA 摘要",
    description:
      "选择或拖拽文件，计算 MD5、SHA-1、SHA-256、SHA-512 摘要，用于校验下载文件的完整性。",
    path: "/tools/file-hash",
    icon: "file-hash",
    lamp: "ok",
    tags: ["文件摘要", "完整性校验", "拖拽"],
  },
  {
    id: "device-info",
    index: "T-16",
    name: "设备信息",
    tagline: "屏幕 / 系统 / 浏览器环境",
    description:
      "读取当前设备的屏幕尺寸、像素密度、操作系统、浏览器、语言、时区、在线状态、CPU 核数等信息，窗口或网络变化时自动刷新。全部本地读取，不上传。",
    path: "/tools/device-info",
    icon: "device-info",
    lamp: "ok",
    tags: ["屏幕", "系统", "浏览器", "环境"],
  },
  {
    id: "case",
    index: "T-17",
    name: "Case converter",
    tagline: "大小写与命名风格转换",
    description:
      "把文本转换成 UPPERCASE / lowercase / Title Case / camelCase / PascalCase / snake_case / kebab-case / CONSTANT_CASE / dot.case 等 10 种格式，实时预览一键复制。",
    path: "/tools/case",
    icon: "case",
    lamp: "ok",
    tags: ["camelCase", "snake_case", "kebab-case", "命名风格"],
  },
  {
    id: "mime",
    index: "T-18",
    name: "MIME types",
    tagline: "MIME ↔ 扩展名互查",
    description:
      "查询 MIME 类型对应的文件扩展名（如 image/png → .png），或反向由扩展名查 MIME。内置常用类型表，支持关键词搜索。",
    path: "/tools/mime",
    icon: "mime",
    lamp: "ok",
    tags: ["MIME", "扩展名", "双向查询"],
  },
  {
    id: "http-status",
    index: "T-19",
    name: "HTTP 状态码",
    tagline: "状态码速查 · 数字 / 英文 / 中文",
    description:
      "内置 1xx~5xx 常用 HTTP 状态码表，支持按数字、英文名或中文含义搜索，按类别分组展示，点击一键复制。全部本地查询，不上传。",
    path: "/tools/http-status",
    icon: "http-status",
    lamp: "ok",
    tags: ["HTTP", "状态码", "404", "速查"],
  },
  {
    id: "badge",
    index: "T-22",
    name: "徽章生成",
    tagline: "shields.io 风格徽章",
    description:
      "填写 label、message、颜色与样式，实时预览 shields.io 风格徽章，一键复制 Markdown / HTML / 直链。",
    path: "/tools/badge",
    icon: "badge",
    lamp: "ok",
    tags: ["徽章", "shields.io", "Markdown"],
  },
  {
    id: "markdown",
    index: "T-23",
    name: "Markdown 编辑器",
    tagline: "实时预览 / 转 HTML / PDF",
    description:
      "编辑 Markdown 实时预览（GFM），一键复制或下载完整 HTML，浏览器打印导出 PDF。全部本地渲染，不上传。",
    path: "/tools/markdown",
    icon: "markdown",
    lamp: "ok",
    tags: ["Markdown", "HTML", "PDF", "预览"],
  },
  {
    id: "pdf",
    index: "T-20",
    name: "PDF 工具箱",
    tagline: "合并 / 拆分 / 旋转 / 压缩 / 转图片 / 图片转 PDF / 扫描件合成 / 删页 / 页码 / 水印 / 加密",
    description:
      "一站式 PDF 处理：合并、按范围提取与每 N 页拆分、逐页旋转（含智能方向检测与全屏大预览）、压缩瘦身、PDF 转 JPG/PNG、图片合并转 PDF、扫描件合成（图片 / PDF / Word 多来源混合栅格化为扫描件页并合成一个 PDF，支持灰度 / 黑白效果）、删页与重排、添加页码、文字水印、密码加密与解密。全部在浏览器本地处理，文件不上传。",
    path: "/tools/pdf",
    icon: "pdf",
    lamp: "ok",
    tags: ["PDF", "合并", "拆分", "旋转", "压缩", "转图片", "扫描件", "水印", "加密"],
  },
  {
    id: "http-parse",
    index: "T-24",
    name: "请求头解析",
    tagline: "UA / Cookie / URL / Query / Header / Set-Cookie",
    description:
      "粘贴原始字符串即可结构化解析：User-Agent 拆出浏览器/系统/设备，Cookie 与 Query String 拆键值对，URL 拆协议/主机/端口/路径，HTTP Header 与 Set-Cookie 逐行解析属性。全部本地处理，不上传。",
    path: "/tools/http-parse",
    icon: "http-parse",
    lamp: "ok",
    tags: ["HTTP", "User-Agent", "Cookie", "URL", "Header", "解析"],
  },
  {
    id: "ws-test",
    index: "T-25",
    name: "WebSocket / SSE 测试",
    tagline: "连接测试 · 收发消息 · 实时日志",
    description:
      "WebSocket 测试：连接 ws/wss 地址，发送与接收文本/二进制消息，状态灯与时间线日志。SSE 测试：EventSource 流式订阅，支持 GET/POST、自定义 Headers 与请求体，事件名/数据/id 逐条展示。全部在浏览器本地完成。",
    path: "/tools/ws-test",
    icon: "ws-test",
    lamp: "ok",
    tags: ["WebSocket", "SSE", "连接", "测试", "实时"],
  },
  {
    id: "vercel-clean",
    index: "T-26",
    name: "Vercel 部署清理",
    tagline: "批量删除旧部署 · 保留最新 N 个",
    description:
      "连接 Vercel 账号，拉取项目与部署列表，每个项目独立保留最新 N 个部署，其余批量并发删除。支持手动 Token 或 OAuth 登录，Token 仅存内存、关闭即清除，实时日志展示删除进度。",
    path: "/tools/vercel-clean",
    icon: "vercel-clean",
    lamp: "ok",
    tags: ["Vercel", "部署", "清理", "批量删除", "DevOps"],
  },
  {
    id: "github-release-clean",
    index: "T-27",
    name: "GitHub Release 清理",
    tagline: "批量删除旧 Release · 保留最新 N 个 · 可选删 Tag",
    description:
      "连接 GitHub 账号，拉取仓库与 Release 列表，每个仓库独立保留最新 N 个 Release，其余批量并发删除。可选同时删除对应的 Git tag。Token 仅存内存、关闭即清除，实时日志展示删除进度。",
    path: "/tools/github-release-clean",
    icon: "github-release-clean",
    lamp: "ok",
    tags: ["GitHub", "Release", "清理", "批量删除", "DevOps"],
  },
  {
    id: "recorder",
    index: "T-33",
    name: "屏幕 / 摄像头录制",
    tagline: "录屏带系统声音 · 摄像头录制 · MP4 / WebM",
    description:
      "浏览器内直接录制屏幕（可选系统声音与麦克风）或摄像头画面，实时计时与预览，输出 MP4（Chrome 126+，不支持时自动回退 WebM），录制完成可预览并下载。录制内容全程本地，不上传任何服务器。",
    path: "/tools/recorder",
    icon: "recorder",
    lamp: "ok",
    tags: ["录制", "屏幕", "摄像头", "MediaRecorder", "MP4", "WebM", "本地"],
  },
  {
    id: "video-convert",
    index: "T-39",
    name: "视频格式转换",
    tagline: "MP4 / WebM / MOV / MKV / GIF",
    description:
      "把视频在浏览器本地转换成 MP4、WebM、MOV、MKV 或 GIF。MP4 / MOV / MKV 之间互转优先无损封装（不重新编码、画质不变），WebM / GIF 重新编码。基于 ffmpeg.wasm，文件不上传服务器。",
    path: "/tools/video-convert",
    icon: "video",
    lamp: "ok",
    tags: ["视频", "格式转换", "MP4", "WebM", "MOV", "MKV", "GIF", "ffmpeg", "本地"],
  },
  {
    id: "ocr",
    index: "T-34",
    name: "OCR 文字识别",
    tagline: "图片 / PDF / Word 文字识别 · 本地运行",
    description:
      "基于 PaddleOCR 引擎（PixPin 同源）在浏览器本地识别文字，中文更准确。支持图片、PDF 与 Word(docx)，Word 直接提取文档文字，内嵌扫描图单独识别，可一键复制结果。文件不上传服务器，引擎与模型自托管。",
    path: "/tools/ocr",
    icon: "ocr",
    lamp: "ok",
    tags: ["OCR", "文字识别", "PaddleOCR", "中文", "PDF", "Word", "本地"],
  },
  {
    id: "excel-functions",
    index: "T-37",
    name: "Excel 函数快查",
    tagline: "63 个常用函数 · 语法 / 参数 / 示例 / 交互模拟",
    description:
      "Excel 常用函数速查：列表展示函数名与简介，常用函数置顶；点击进入详情查看语法、参数说明与示例，并附可交互的迷你模拟器（输入参数实时出结果，VLOOKUP 带模拟表高亮）。",
    path: "/tools/excel-functions",
    icon: "excel-functions",
    lamp: "ok",
    tags: ["Excel", "函数", "速查", "SUM", "VLOOKUP", "教程"],
  },
  {
    id: "web-nav",
    index: "T-40",
    name: "好用网站导航",
    tagline: "精选第三方在线工具 · 纯外链跳转",
    description:
      "精选一批好用、稳定的第三方在线工具（PDF 处理、文件传输、图片处理、格式转换、开发速查、AI 助手等），点击直达，本站只做推荐跳转、不做功能。自研工具保留不动，第三方作为补充。",
    path: "/tools/web-nav",
    icon: "web-nav",
    lamp: "ok",
    tags: ["导航", "推荐", "外链", "Smallpdf", "轻松传", "第三方"],
  },
  {
    id: "print",
    index: "T-41",
    name: "文件打印",
    tagline: "上传 PDF / 图片 / Word / 文本，调本机打印机",
    description:
      "上传 PDF、图片、Word 或文本文件，预览后用浏览器调用本机连接的打印机直接打印。可选纸张（A4/A5/Letter/Legal）、方向、清晰度与边距；PDF 按所选 DPI 高清栅格化打印。文件在本地处理，不上传服务器。",
    path: "/tools/print",
    icon: "print",
    lamp: "ok",
    tags: ["打印", "PDF", "图片", "Word", "本机打印机", "纸张", "DPI"],
  },
];

export const soonTools: { name: string; hint: string }[] = [];

export const GITHUB_REPO = "https://github.com/lsx-xyg/tools";
