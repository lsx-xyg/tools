/** 工具注册表：新增工具 = 在这里加一项 + 加一个页面 */

export type ToolId = "transfer" | "qr" | "base64" | "json" | "cron" | "convert";

export interface Tool {
  id: ToolId;
  index: string; // 仪表编号，如 T-01
  name: string;
  tagline: string;
  description: string;
  path: string;
  icon: "transfer" | "qr" | "base64" | "json" | "cron" | "convert";
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
      "在线模式设备间点对点直传，文件不经过服务器；离线模式云端暂存 24 小时后自动清除。发送文本或文件，获得 6 位提取码，另一台设备扫码或输码即可取回。",
    path: "/tools/transfer",
    icon: "transfer",
    lamp: "ok",
    tags: ["在线直传", "免登录", "24h 自动清除"],
  },
  {
    id: "qr",
    index: "T-02",
    name: "二维码生成",
    tagline: "文本 / 链接转二维码",
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
    tagline: "YAML / XML / CSV / INI ↔ JSON",
    description:
      "把 YAML、XML、CSV、INI、Properties 等格式统一解析成 JSON，再输出成任意目标格式。双向互转、纯本地运行，不经过服务器。",
    path: "/tools/convert",
    icon: "convert",
    lamp: "ok",
    tags: ["YAML", "XML", "CSV", "INI", "Properties"],
  },
];

export const soonTools = [
  { name: "正则测试", hint: "正则匹配 / 替换预览" },
  { name: "时间戳转换", hint: "Unix 时间 ↔ 日期" },
];

export const GITHUB_REPO = "https://github.com/lsx-xyg/tools";
