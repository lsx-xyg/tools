/** 工具注册表：新增工具 = 在这里加一项 + 加一个页面 */

export type ToolId = "transfer";

export interface Tool {
  id: ToolId;
  index: string; // 仪表编号，如 T-01
  name: string;
  tagline: string;
  description: string;
  path: string;
  icon: "transfer";
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
];

export const soonTools = [
  { name: "二维码生成", hint: "文本 / 链接转二维码" },
  { name: "JSON 格式化", hint: "格式化 / 校验 / 压缩" },
];

export const GITHUB_REPO = "https://github.com/lsx-xyg/tools";
