/**
 * HTTP 状态码表（1xx~5xx 常用码，含中文说明）。
 * 纯本地，无请求。
 */

export interface HttpStatus {
  code: number;
  name: string;
  zh: string;
  group: "1xx" | "2xx" | "3xx" | "4xx" | "5xx";
}

export const HTTP_GROUPS: { group: HttpStatus["group"]; label: string; hint: string }[] = [
  { group: "1xx", label: "1xx 信息响应", hint: "请求已接收，继续处理" },
  { group: "2xx", label: "2xx 成功", hint: "请求成功处理" },
  { group: "3xx", label: "3xx 重定向", hint: "需进一步操作完成请求" },
  { group: "4xx", label: "4xx 客户端错误", hint: "请求包含错误或无法处理" },
  { group: "5xx", label: "5xx 服务端错误", hint: "服务器处理请求失败" },
];

export const HTTP_STATUS: HttpStatus[] = [
  // ---- 1xx ----
  { code: 100, name: "Continue", zh: "继续", group: "1xx" },
  { code: 101, name: "Switching Protocols", zh: "切换协议", group: "1xx" },
  { code: 102, name: "Processing", zh: "处理中", group: "1xx" },
  { code: 103, name: "Early Hints", zh: "提前提示", group: "1xx" },
  // ---- 2xx ----
  { code: 200, name: "OK", zh: "请求成功", group: "2xx" },
  { code: 201, name: "Created", zh: "已创建", group: "2xx" },
  { code: 202, name: "Accepted", zh: "已接受", group: "2xx" },
  { code: 203, name: "Non-Authoritative Information", zh: "非权威信息", group: "2xx" },
  { code: 204, name: "No Content", zh: "无内容", group: "2xx" },
  { code: 205, name: "Reset Content", zh: "重置内容", group: "2xx" },
  { code: 206, name: "Partial Content", zh: "部分内容", group: "2xx" },
  { code: 207, name: "Multi-Status", zh: "多状态", group: "2xx" },
  { code: 208, name: "Already Reported", zh: "已报告", group: "2xx" },
  { code: 226, name: "IM Used", zh: "使用了 IM", group: "2xx" },
  // ---- 3xx ----
  { code: 300, name: "Multiple Choices", zh: "多种选择", group: "3xx" },
  { code: 301, name: "Moved Permanently", zh: "永久移动", group: "3xx" },
  { code: 302, name: "Found", zh: "临时移动", group: "3xx" },
  { code: 303, name: "See Other", zh: "查看其他位置", group: "3xx" },
  { code: 304, name: "Not Modified", zh: "未修改", group: "3xx" },
  { code: 305, name: "Use Proxy", zh: "使用代理", group: "3xx" },
  { code: 307, name: "Temporary Redirect", zh: "临时重定向", group: "3xx" },
  { code: 308, name: "Permanent Redirect", zh: "永久重定向", group: "3xx" },
  // ---- 4xx ----
  { code: 400, name: "Bad Request", zh: "请求错误", group: "4xx" },
  { code: 401, name: "Unauthorized", zh: "未授权", group: "4xx" },
  { code: 402, name: "Payment Required", zh: "需要付费", group: "4xx" },
  { code: 403, name: "Forbidden", zh: "禁止访问", group: "4xx" },
  { code: 404, name: "Not Found", zh: "未找到", group: "4xx" },
  { code: 405, name: "Method Not Allowed", zh: "方法不允许", group: "4xx" },
  { code: 406, name: "Not Acceptable", zh: "不可接受", group: "4xx" },
  { code: 407, name: "Proxy Authentication Required", zh: "需要代理认证", group: "4xx" },
  { code: 408, name: "Request Timeout", zh: "请求超时", group: "4xx" },
  { code: 409, name: "Conflict", zh: "冲突", group: "4xx" },
  { code: 410, name: "Gone", zh: "已删除", group: "4xx" },
  { code: 411, name: "Length Required", zh: "需要内容长度", group: "4xx" },
  { code: 412, name: "Precondition Failed", zh: "前置条件失败", group: "4xx" },
  { code: 413, name: "Payload Too Large", zh: "载荷过大", group: "4xx" },
  { code: 414, name: "URI Too Long", zh: "URI 过长", group: "4xx" },
  { code: 415, name: "Unsupported Media Type", zh: "不支持的媒体类型", group: "4xx" },
  { code: 416, name: "Range Not Satisfiable", zh: "范围不满足", group: "4xx" },
  { code: 417, name: "Expectation Failed", zh: "期望失败", group: "4xx" },
  { code: 418, name: "I'm a Teapot", zh: "我是茶壶", group: "4xx" },
  { code: 421, name: "Misdirected Request", zh: "错误指向请求", group: "4xx" },
  { code: 422, name: "Unprocessable Entity", zh: "无法处理实体", group: "4xx" },
  { code: 423, name: "Locked", zh: "已锁定", group: "4xx" },
  { code: 424, name: "Failed Dependency", zh: "依赖失败", group: "4xx" },
  { code: 425, name: "Too Early", zh: "请求过早", group: "4xx" },
  { code: 426, name: "Upgrade Required", zh: "需要升级", group: "4xx" },
  { code: 428, name: "Precondition Required", zh: "需要前置条件", group: "4xx" },
  { code: 429, name: "Too Many Requests", zh: "请求过多", group: "4xx" },
  { code: 431, name: "Request Header Fields Too Large", zh: "请求头字段过大", group: "4xx" },
  { code: 451, name: "Unavailable For Legal Reasons", zh: "因法律原因不可用", group: "4xx" },
  // ---- 5xx ----
  { code: 500, name: "Internal Server Error", zh: "服务器内部错误", group: "5xx" },
  { code: 501, name: "Not Implemented", zh: "未实现", group: "5xx" },
  { code: 502, name: "Bad Gateway", zh: "网关错误", group: "5xx" },
  { code: 503, name: "Service Unavailable", zh: "服务不可用", group: "5xx" },
  { code: 504, name: "Gateway Timeout", zh: "网关超时", group: "5xx" },
  { code: 505, name: "HTTP Version Not Supported", zh: "HTTP 版本不支持", group: "5xx" },
  { code: 506, name: "Variant Also Negotiates", zh: "变体协商", group: "5xx" },
  { code: 507, name: "Insufficient Storage", zh: "存储不足", group: "5xx" },
  { code: 508, name: "Loop Detected", zh: "检测到循环", group: "5xx" },
  { code: 510, name: "Not Extended", zh: "未扩展", group: "5xx" },
  { code: 511, name: "Network Authentication Required", zh: "需要网络认证", group: "5xx" },
];

export function searchStatus(q: string): HttpStatus[] {
  const s = q.trim().toLowerCase();
  if (!s) return [...HTTP_STATUS];
  return HTTP_STATUS.filter(
    (e) =>
      String(e.code).includes(s) ||
      e.name.toLowerCase().includes(s) ||
      e.zh.toLowerCase().includes(s),
  );
}
