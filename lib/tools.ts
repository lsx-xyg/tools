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
export type ToolId = BaseToolId | "image" | "badge" | "markdown" | "http-parse" | "ws-test" | "vercel-clean" | "github-release-clean" | "video" | "audio" | "media-info" | "video-frames" | "image-batch" | "recorder" | "ocr" | "ip-lookup" | "dns-lookup" | "excel-functions" | "pdf-auto-rotate";

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
    | "markdown"
    | "http-parse"
    | "ws-test"
    | "vercel-clean"
    | "github-release-clean"
    | "video"
    | "audio"
    | "media-info"
    | "video-frames"
    | "image-batch"
    | "recorder"
    | "ocr"
    | "ip-lookup"
    | "dns-lookup"
    | "excel-functions"
    | "pdf-auto-rotate";
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
    id: "video",
    index: "T-28",
    name: "视频处理",
    tagline: "裁剪 / 转 GIF / 提取音频 / 转换 / 拼接 / 压缩",
    description:
      "基于 ffmpeg.wasm 的浏览器端视频处理：裁剪时间段、转 GIF、提取音频、格式转换、多片段拼接、按画质压缩。全部在本地完成，视频不上传服务器，关掉页面即彻底清除。",
    path: "/tools/video",
    icon: "video",
    lamp: "ok",
    tags: ["视频", "ffmpeg", "裁剪", "转GIF", "提取音频", "格式转换", "拼接", "压缩"],
  },
  {
    id: "audio",
    index: "T-29",
    name: "音频处理",
    tagline: "格式转换 / 拼接 / 裁剪 / 变速变调",
    description:
      "基于 ffmpeg.wasm 的浏览器端音频处理：mp3 / wav / m4a / ogg / flac / opus 格式互转、多段拼接、时间段裁剪、速度与音调调节。全部在本地完成，音频不上传服务器。",
    path: "/tools/audio",
    icon: "audio",
    lamp: "ok",
    tags: ["音频", "ffmpeg", "格式转换", "拼接", "裁剪", "变速变调"],
  },
  {
    id: "media-info",
    index: "T-30",
    name: "媒体信息",
    tagline: "查看音视频编码 / 码率 / 分辨率 / 时长",
    description:
      "本地解析视频与音频文件的容器、编码、码率、分辨率、采样率、时长等元数据，支持一次上传多个文件，查看原始 ffmpeg 输出。文件不上传服务器。",
    path: "/tools/media-info",
    icon: "media-info",
    lamp: "ok",
    tags: ["媒体", "视频", "音频", "元数据", "ffprobe", "本地解析"],
  },
  {
    id: "video-frames",
    index: "T-31",
    name: "视频抽帧 / 倍速",
    tagline: "抽帧导出图片 · GIF 转视频 · 倍速转换",
    description:
      "按时间点或间隔从视频中抽取帧导出 PNG；将 GIF 转换为 mp4 / webm / mov 视频；按倍率加速或减速视频（0.25x ~ 8x，音频同步变速）。全部在本地完成，不上传服务器。",
    path: "/tools/video-frames",
    icon: "video-frames",
    lamp: "ok",
    tags: ["视频", "抽帧", "GIF", "倍速", "ffmpeg", "本地处理"],
  },
  {
    id: "image-batch",
    index: "T-32",
    name: "图片批量处理",
    tagline: "批量压缩 · 批量加水印（文字 / 图片）",
    description:
      "多张图片批量压缩（可调质量与缩放比例）、批量添加文字或图片水印（九宫格位置、大小、透明度可调），一键打包成 ZIP 下载。全部在浏览器本地用 Canvas 完成，图片不上传。",
    path: "/tools/image-batch",
    icon: "image-batch",
    lamp: "ok",
    tags: ["图片", "批量", "压缩", "水印", "ZIP", "本地处理"],
  },
  {
    id: "recorder",
    index: "T-33",
    name: "屏幕 / 摄像头录制",
    tagline: "录屏带系统声音 · 摄像头录制 · 本地保存",
    description:
      "浏览器内直接录制屏幕（可选系统声音与麦克风）或摄像头画面，实时计时，录制完成可预览并下载 WebM 文件。录制内容全程本地，不上传任何服务器。",
    path: "/tools/recorder",
    icon: "recorder",
    lamp: "ok",
    tags: ["录制", "屏幕", "摄像头", "MediaRecorder", "本地"],
  },
  {
    id: "ocr",
    index: "T-34",
    name: "OCR 文字识别",
    tagline: "图片文字识别（中 / 英）· 本地运行",
    description:
      "基于 tesseract.js 在浏览器本地识别图片中的文字，支持简体中文、English 与中英混合，可一键复制结果。图片不上传服务器，识别引擎与语言数据自托管。",
    path: "/tools/ocr",
    icon: "ocr",
    lamp: "ok",
    tags: ["OCR", "文字识别", "tesseract", "中文", "English", "本地"],
  },
  {
    id: "ip-lookup",
    index: "T-35",
    name: "IP 归属地查询",
    tagline: "查询 IP 归属地 / 运营商 / 时区",
    description:
      "查询任意 IPv4 / IPv6 的归属地、国家、城市、运营商、ASN 与时区信息；留空可查询本机出口 IP。数据来自 ipwho.is 免费接口。",
    path: "/tools/ip-lookup",
    icon: "ip-lookup",
    lamp: "ok",
    tags: ["IP", "归属地", "查询", "运营商", "IPv6"],
  },
  {
    id: "dns-lookup",
    index: "T-36",
    name: "DNS 解析查询",
    tagline: "DoH 查询 A / AAAA / CNAME / MX / TXT 等",
    description:
      "通过 Cloudflare DNS-over-HTTPS 查询域名的各类解析记录，包括 A、AAAA、CNAME、MX、NS、TXT、SOA、SRV、PTR、CAA。绕过本地 DNS 缓存，观察公网解析结果。",
    path: "/tools/dns-lookup",
    icon: "dns-lookup",
    lamp: "ok",
    tags: ["DNS", "DoH", "解析", "域名", "Cloudflare"],
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
    id: "pdf-auto-rotate",
    index: "T-38",
    name: "PDF 自动旋转",
    tagline: "批量识别方向并旋转正 · 快速 / OCR 深度双模式",
    description:
      "上传多个 PDF 或 ZIP 压缩包，自动识别每页方向并旋转正。快速模式读取 /Rotate 属性修正误设旋转；深度模式通过 OCR 识别文字实际方向（0°/90°/180°/270°），适合扫描件。全部本地处理，文件不上传。",
    path: "/tools/pdf-auto-rotate",
    icon: "pdf-auto-rotate",
    lamp: "ok",
    tags: ["PDF", "旋转", "自动", "OCR", "扫描件", "批量"],
  },
];

export const soonTools: { name: string; hint: string }[] = [];

export const GITHUB_REPO = "https://github.com/lsx-xyg/tools";
