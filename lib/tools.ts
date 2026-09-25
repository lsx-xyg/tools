/** 工具注册表：新增工具 = 在这里加一项 + 加一个页面 */

/** 基础工具 id（第一批 20 个） */
type BaseToolId =
  | "transfer"
  | "qr"
  | "base64"
  | "json"
  | "cron"
  | "convert"
  | "ts"
  | "hash"
  | "uuid"
  | "diff"
  | "regex"
  | "text"
  | "url"
  | "jwt"
  | "file-hash"
  | "device-info"
  | "case"
  | "mime"
  | "http-status"
  | "pdf";

/** 全部工具 id（含第二批新工具） */
export type ToolId = BaseToolId | "image" | "badge" | "markdown";

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
    | "base64"
    | "json"
    | "cron"
    | "convert"
    | "ts"
    | "hash"
    | "uuid"
    | "diff"
    | "regex"
    | "text"
    | "url"
    | "jwt"
    | "file-hash"
    | "device-info"
    | "case"
    | "mime"
    | "http-status"
    | "pdf"
    | "image"
    | "badge"
    | "markdown";
  lamp: "ok" | "amber";
  tags: string[];
  soon?: boolean;
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
    id: "base64",
    index: "T-03",
    name: "Base64 编码",
    tagline: "编码 / 解码，中文安全",
    description:
      "文本与 Base64 互相转换，UTF-8 安全（中文、emoji 不乱码）。支持编码 / 解码双向切换，一键复制结果。",
    path: "/tools/base64",
    icon: "base64",
    lamp: "ok",
    tags: ["编码", "解码", "UTF-8 安全"],
  },
  {
    id: "json",
    index: "T-04",
    name: "JSON 格式化",
    tagline: "格式化 / 校验 / 压缩",
    description:
      "粘贴 JSON 一键格式化、校验语法、压缩成单行。报错定位到具体行，方便调试接口返回与配置文件。",
    path: "/tools/json",
    icon: "json",
    lamp: "ok",
    tags: ["格式化", "校验", "压缩"],
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
    id: "url",
    index: "T-13",
    name: "URL 编码 / 解码",
    tagline: "encodeURIComponent 安全转换",
    description:
      "文本与 URL 编码互相转换，UTF-8 安全（中文、emoji 不乱码），支持编码 / 解码双向切换。",
    path: "/tools/url",
    icon: "url",
    lamp: "ok",
    tags: ["编码", "解码", "UTF-8 安全"],
  },
  {
    id: "jwt",
    index: "T-14",
    name: "JWT 解析 / 生成",
    tagline: "解码 / 签名验证 / 生成",
    description:
      "粘贴 JWT 自动解码 Header 与 Payload，支持 HS / RS / ES / PS 系列签名验证与重新生成，密钥支持 String / Hex / Base64 / PEM / JWK。全部本地完成，不上传。",
    path: "/tools/jwt",
    icon: "jwt",
    lamp: "ok",
    tags: ["JWT", "Header", "Payload", "过期时间"],
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
    id: "image",
    index: "T-21",
    name: "图片处理",
    tagline: "压缩 / 缩放 / 裁剪 / 转换",
    description:
      "上传图片，本地完成压缩（JPEG / WebP 质量可调）、缩放（等比 / 指定尺寸）、裁剪（自由比例 / 预设比例）与格式转换，一键下载。全部本地浏览器处理，不上传服务器。",
    path: "/tools/image",
    icon: "image",
    lamp: "ok",
    tags: ["压缩", "缩放", "裁剪", "格式转换"],
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
    name: "PDF 处理",
    tagline: "合并 / 拆分 / 提取页面",
    description:
      "把多个 PDF 按顺序合并成一个；或按页码范围提取指定页、每 N 页拆分打包下载。全部在浏览器本地处理，文件不上传。",
    path: "/tools/pdf",
    icon: "pdf",
    lamp: "ok",
    tags: ["PDF", "合并", "拆分", "提取页面"],
  },
];

export const soonTools: { name: string; hint: string }[] = [];

export const GITHUB_REPO = "https://github.com/lsx-xyg/tools";
