/**
 * 好用网站导航数据（T-40）
 * 纯外链推荐，本站不做功能，点击跳转到第三方好用站点。
 * URL 均为已验证的 HTTPS 官网/主页。
 */
export interface WebNavSite {
  name: string;
  url: string;
  desc: string;
}

export interface WebNavCategory {
  id: string;
  name: string;
  icon: string;
  sites: WebNavSite[];
}

export const WEB_NAV_CATEGORIES: WebNavCategory[] = [
  {
    id: "pdf",
    name: "PDF 处理",
    icon: "pdf",
    sites: [
      { name: "Smallpdf", url: "https://smallpdf.com/", desc: "PDF 全套：合并、压缩、转换、编辑、签名，界面清爽好用" },
      { name: "iLovePDF", url: "https://www.ilovepdf.com/zh-cn", desc: "免费在线 PDF 工具：合并、拆分、压缩、旋转、加解锁" },
      { name: "PDF24 Tools", url: "https://tools.pdf24.org/zh/", desc: "30+ 免费 PDF 工具集合，无水印、无需注册" },
      { name: "PDFgear", url: "https://www.pdfgear.com/zh/", desc: "免费 PDF 编辑/阅读，可直接编辑文本与批注" },
    ],
  },
  {
    id: "transfer",
    name: "文件传输与分享",
    icon: "transfer",
    sites: [
      { name: "轻松传 EasyTransfer", url: "https://easychuan.cn/", desc: "手机 / 电脑 / 平板跨设备互传文件、文本、屏幕与实时视频" },
      { name: "奶牛快传", url: "https://cowtransfer.com/", desc: "大文件快传，无需注册，自动生成取件链接" },
      { name: "文叔叔", url: "https://www.wenshushu.cn/", desc: "文件 / 大文件速传，多人批量收发" },
      { name: "Sharedrop", url: "https://www.sharedrop.io/", desc: "免登录 WebRTC 点对点传文件，内容不经过服务器" },
      { name: "TMP.LINK", url: "https://tmp.link/", desc: "文件临时分享，到期自动销毁" },
    ],
  },
  {
    id: "image",
    name: "图片处理",
    icon: "image",
    sites: [
      { name: "Squoosh", url: "https://squoosh.app/", desc: "Google 出品，图片无损压缩，支持 WebP / AVIF" },
      { name: "TinyPNG", url: "https://tinypng.com/", desc: "PNG / WebP 智能压缩，肉眼无损" },
      { name: "remove.bg", url: "https://www.remove.bg/zh", desc: "AI 一键抠图去背景" },
      { name: "Photopea", url: "https://www.photopea.com/", desc: "免费在线「Photoshop」，支持 PSD 直接编辑" },
      { name: "PixPin", url: "https://pixpin.cn/", desc: "截图 + 贴图 + 长截图 + OCR 识别（桌面软件）" },
    ],
  },
  {
    id: "convert",
    name: "格式转换",
    icon: "convert",
    sites: [
      { name: "Convertio", url: "https://convertio.co/zh/", desc: "400+ 格式在线转换：音视频、图片、文档、压缩包" },
      { name: "CloudConvert", url: "https://cloudconvert.com/", desc: "任意格式转换 API 级稳定，支持批量" },
      { name: "Online Convert", url: "https://www.online-convert.com/", desc: "在线转换各类文件格式" },
    ],
  },
  {
    id: "dev",
    name: "开发与速查",
    icon: "json",
    sites: [
      { name: "Regex101", url: "https://regex101.com/", desc: "正则表达式在线测试与可视化" },
      { name: "CanIUse", url: "https://caniuse.com/", desc: "前端特性浏览器兼容性速查" },
      { name: "DevDocs", url: "https://devdocs.io/", desc: "聚合开发者文档，离线可查" },
      { name: "JSON.cn", url: "https://www.json.cn/", desc: "JSON 格式化 / 校验 / 转换" },
      { name: "GitHub", url: "https://github.com/", desc: "代码托管与开源协作" },
      { name: "软仓", url: "https://www.ruancang.net/", desc: "专业软件导航与下载平台：Adobe 全家桶、设计 / 工程 / 影视等软件资源速查" },
    ],
  },
  {
    id: "ai",
    name: "AI 助手",
    icon: "ocr",
    sites: [
      { name: "豆包", url: "https://www.doubao.com/", desc: "字节跳动 AI 助手，随时提问" },
      { name: "Kimi", url: "https://kimi.moonshot.cn/", desc: "长文本阅读与写作助手" },
      { name: "DeepSeek", url: "https://www.deepseek.com/", desc: "免费开放的大模型对话" },
    ],
  },
];
