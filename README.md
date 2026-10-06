<div align="center">

<img src="docs/logo.svg" alt="工具箱 TOOLBOX" width="120" />

# 工具箱 TOOLBOX

**一个部署在 Cloudflare Workers 上的在线工具箱，36 个即开即用的小工具，无需注册登录。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare)](https://workers.cloudflare.com)
[![Deploy](https://github.com/lsx-xyg/tools/actions/workflows/deploy.yml/badge.svg)](https://github.com/lsx-xyg/tools/actions)

[在线体验](https://tools.dbthree.dpdns.org) · [反馈](https://github.com/lsx-xyg/tools/issues)

</div>

---

## 目录

- [💡 这是什么](#-这是什么)
- [✨ 功能](#-功能)
- [🚀 安装](#-安装)
- [📖 使用](#-使用)
- [⚙️ 配置](#️-配置)
- [🛠️ 开发](#️-开发)
- [📁 项目结构](#-项目结构)
- [🧩 扩展](#-扩展)
- [🤝 贡献](#-贡献)
- [📄 License](#-license)

---

## 💡 这是什么

工具箱是一个可自部署的在线工具集合，覆盖开发者日常高频操作：编码转换、文本处理、数据格式化、文件传输、DevOps 清理等。

- **纯前端计算**：大部分工具在浏览器本地完成，数据不离开设备。
- **到期自动销毁**：涉及传输的工具支持离线暂存，按 TTL 自动清除。
- **可自部署**：基于 Cloudflare Workers，一键部署到自己的账号。

> [!TIP]
> 在线体验地址：[tools.dbthree.dpdns.org](https://tools.dbthree.dpdns.org)

---

## ✨ 功能

| 功能 | 说明 |
| :--- | :--- |
| 📁 文本 / 文件互传 | WebRTC P2P 直传（不落服务器）· 离线暂存（时长 / 次数可自定义）· 提取码 / 扫码 |
| 🔲 二维码生成 / 解析 | 生成二维码或解析二维码图片 |
| 🔤 Base64 编码 | 编码 / 解码，中文安全 |
| 📋 JSON 格式化 | 格式化 / 校验 / 压缩 |
| ⏰ Cron 表达式 | 解析下次执行时间，可视化生成 |
| 🔄 格式互转 | YAML / XML / CSV / INI / TOML / Properties ↔ JSON |
| 🕐 时间戳转换 | Unix 时间 ↔ 日期时间 |
| 🔐 Hash 计算 | MD5 / SHA 系列 / HMAC |
| 🆔 UUID 生成 | 批量 v4，本地随机 |
| 📝 文本 Diff 对比 | 两栏对比，差异高亮 |
| 🔍 正则测试器 | 匹配预览与捕获组 |
| 🧰 文本处理合集 | 大小写 / 排序 / 去重等 |
| 🔗 URL 编码 / 解码 | encodeURIComponent 安全转换 |
| 🎫 JWT 解析 / 生成 | 解码 / 签名验证 / 生成 |
| 📂 文件哈希校验 | 本地文件的 MD5 / SHA 摘要 |
| 💻 设备信息 | 屏幕 / 系统 / 浏览器 / 设备架构 |
| 🔠 Case converter | 大小写与命名风格转换 |
| 📑 MIME types | MIME ↔ 扩展名互查 |
| 🌐 HTTP 状态码 | 状态码速查 · 数字 / 英文 / 中文 |
| 📄 PDF 处理 | 合并 / 拆分 / 提取页面 |
| 🖼️ 图片处理 | 格式转换 / 压缩 / 缩放 / 裁剪 |
| 🏷️ 徽章生成 | shields.io 风格徽章 |
| ✍️ Markdown 编辑器 | 实时预览 / 转 HTML / PDF |
| 📨 请求头解析 | UA / Cookie / URL / Query / Header / Set-Cookie |
| 🔌 WebSocket / SSE 测试 | 连接测试 · 收发消息 · 实时日志 |
| ☁️ Vercel 部署清理 | 批量删除旧部署 · 保留最新 N 个 |
| 🐙 GitHub Release 清理 | 批量删除旧 Release · 保留最新 N 个 · 可选删 Tag |
| 🎬 视频处理 | 裁剪 / 转 GIF / 提取音频 / 格式转换 / 拼接 / 压缩 |
| 🎵 音频处理 | 格式转换 / 拼接 / 裁剪 / 变速变调 |
| 📊 媒体信息 | 容器 / 编码 / 时长 / 码率 / 流信息 |
| 🎞️ 视频抽帧 / 倍速 | 按时间点抽帧 · GIF 转视频 · 倍速播放 |
| 🖼️ 图片批量处理 | 批量压缩 / 加水印 / 图片转 PDF（一页一张） |
| 📹 屏幕 / 摄像头录制 | 录制中实时预览 · 停止自动回放 · 移动端兼容提示 |
| 🔤 OCR 文字识别 | 简体中文 / English，tesseract.js 本地识别 |
| 🌐 IP 归属地查询 | 归属地 / 运营商 / 时区 / ASN |
| 🌍 DNS 解析查询 | DoH 多源自动容错 · CNAME 压平提示 · 代理 IP 识别 |
| 📊 Excel 函数快查 | 63 个常用函数 · 语法 / 参数 / 示例 · 交互模拟器 |
| 🔄 PDF 自动旋转 | 单页拼接预览 · 每页独立旋转 · 智能检测建议方向 |

> 新增工具 = 新建页面 + 在 `lib/tools.ts` 注册一项，自动出现在侧边栏、搜索与仪表台。

---

## 🚀 安装

### 从源码安装

需要 Node.js 18+。

```bash
git clone https://github.com/lsx-xyg/tools.git
cd tools
npm install
```

### 本地开发

```bash
npm run dev
```

访问 `http://localhost:3000`。

> [!NOTE]
> 本地开发时后端自动使用内存 KV + `.local-store/` 目录模拟 KV / R2，可完整跑通发送 / 接收流程（包括双开两个浏览器标签页测试在线直传）。

---

## 📖 使用

1. 打开网站后，通过左侧边栏选择工具，或按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 打开搜索快速定位。
2. 大部分工具为纯前端计算，输入即出结果。
3. 涉及传输的工具（T-01）：
   - **在线直传**：发送端创建房间获得 6 位提取码，接收端输入提取码建立 WebRTC 连接，内容点对点直传，服务器不落盘。
   - **离线暂存**：上传文件或文本后获得提取码，接收端凭码取回；可自定义保留时长（1h ~ 7 天）和下载次数（1 ~ 100 次），到期自动销毁。

<!-- 替换为实际截图：docs/screenshot-main.png -->
![主界面截图](docs/screenshot-main.png)

---

## ⚙️ 配置

### 环境变量

| 变量 | 必需 | 说明 |
| :--- | :--- | :--- |
| `SITE_PASSWORD` | 推荐 | 全站访问密码。未设置时全站拒绝访问（安全兜底） |
| `TRANSFER_KV_ID` | 部署必需 | Cloudflare KV namespace id（通过 secret 或部署脚本注入，不入库） |
| `REDIS_URL` | 可选 | Upstash REST 端点，启用 Redis 存储后端时需要 |
| `REDIS_TOKEN` | 可选 | Upstash 访问令牌 |
| `STORAGE_SWITCH_PASSWORD` | 可选 | 存储后端切换密码；未配置时可在网页首次设置 |

### 限额

<details>
<summary>查看传输限额</summary>

| 项目 | 限制 |
| :--- | :--- |
| 文本 | ≤ 200,000 字符 |
| 文件（离线暂存） | 单次 ≤ 10 个、单个 ≤ 200 MB、总量 ≤ 200 MB |
| 文件（在线直传） | 单次 ≤ 10 个、单个 ≤ 4 GB、总量 ≤ 8 GB |
| 离线保留时长 | 1h / 6h / 24h / 3 天 / 7 天 |
| 文件下载次数 | 1 / 3 / 10 / 100 次 |
| P2P 信令窗口 | 15 分钟；连接超时 90 秒 |

</details>

---

## 🛠️ 开发

### 前置要求

- Node.js 18+
- Cloudflare 账号（部署用）

### 常用命令

```bash
npm run dev       # 本地开发
npm run build     # 构建（含 TypeScript 类型检查）
npm run lint      # ESLint 检查
npm run preview   # 本地预览 Cloudflare Workers 构建产物
npm run deploy    # 部署到 Cloudflare Workers
```

### 部署到 Cloudflare Workers

<details>
<summary>查看完整部署步骤</summary>

1. **准备资源**

   ```bash
   npx wrangler login
   npx wrangler kv namespace create TRANSFER_KV
   npx wrangler r2 bucket create tools-transfer
   ```

2. **注入 KV id**（`wrangler.jsonc` 中为占位符，真实 id 不入库）

   ```bash
   TRANSFER_KV_ID=<你的id> ./scripts/deploy.sh
   ```

3. **设置全站密码**

   ```bash
   npx wrangler secret put SITE_PASSWORD
   ```

4. **配置 R2 生命周期**（控制台 → R2 → `tools-transfer` → 生命周期规则 → 删除对象 → 早于 7 天前）

5. **部署**

   ```bash
   npm run deploy
   ```

6. **GitHub Actions 自动部署**：在仓库 Settings → Secrets 添加 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`TRANSFER_KV_ID`，推送 `main` 即自动部署。

</details>

### 存储后端切换（KV / Redis）

默认使用 Cloudflare KV；可切换到 Redis（Upstash）降低 KV 免费额度消耗。配置 `REDIS_URL` 和 `REDIS_TOKEN` 后，仪表台底部「存储后端 · 管理员」卡片即可切换。切换需输入密码（环境变量 `STORAGE_SWITCH_PASSWORD` 或网页首次设置）。

---

## 📁 项目结构

```text
tools/
├── app/
│   ├── api/                    # API 路由（传输、信令、设置）
│   ├── tools/                  # 各工具页面（每个工具一个目录）
│   │   ├── transfer/           # T-01 文本/文件互传
│   │   ├── qr/                 # T-02 二维码
│   │   ├── json/               # T-04 JSON 格式化
│   │   ├── vercel-clean/       # T-26 Vercel 部署清理
│   │   ├── github-release-clean/ # T-27 GitHub Release 清理
│   │   ├── video/                # T-28 视频处理
│   │   ├── audio/                # T-29 音频处理
│   │   ├── media-info/           # T-30 媒体信息
│   │   ├── video-frames/         # T-31 视频抽帧 / 倍速
│   │   ├── image-batch/          # T-32 图片批量处理
│   │   ├── recorder/             # T-33 屏幕 / 摄像头录制
│   │   ├── ocr/                  # T-34 OCR 文字识别
│   │   ├── ip-lookup/            # T-35 IP 归属地查询
│   │   ├── dns-lookup/           # T-36 DNS 解析查询
│   │   ├── excel-functions/      # T-37 Excel 函数快查（含 [slug] 详情页）
│   │   └── pdf-auto-rotate/       # T-38 PDF 自动旋转
│   ├── globals.css             # 全站样式 + 设计系统
│   ├── layout.tsx              # 根布局（侧边栏 + 内容区）
│   └── page.tsx                # 仪表台首页
├── components/
│   ├── icons.tsx               # lucide 图标封装
│   ├── icon-map.ts             # 工具图标映射
│   ├── tool-head.tsx           # 工具页头部组件
│   └── ui/                     # shadcn 风格组件
├── lib/
│   ├── tools.ts                # 工具注册清单（T-01 ~ T-38）
│   ├── kv.ts                   # KV / R2 / Redis 存储抽象
│   ├── site-auth.ts            # 全站密码认证（HMAC 签名 token）
│   └── rtc-client.ts           # WebRTC 客户端
├── worker-auth.ts              # Cloudflare Worker 入口（全站密码门）
├── wrangler.jsonc              # Cloudflare Workers 配置
├── scripts/
│   └── deploy.sh               # 部署脚本（注入 KV id）
├── .github/workflows/
│   ├── deploy.yml              # 自动部署
│   └── gitleaks.yml            # 密钥扫描
└── package.json
```

---

## 🧩 扩展

### 新增一个工具

1. 新建页面 `app/tools/<slug>/page.tsx`（参考现有工具，纯本地工具无需后端）。
2. 在 `lib/tools.ts` 注册一项：`id`、`name`、`tagline`、`description`、`path`、`icon`（`components/icon-map.ts` 中已定义或新增）、`tags`。
3. 侧边栏、搜索面板（<kbd>Ctrl</kbd> + <kbd>K</kbd>）、仪表台自动出现该工具。

### API 一览

<details>
<summary>查看传输相关 API</summary>

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| POST | `/api/transfer` | 创建离线传输 → 返回提取码 |
| GET | `/api/transfer/:code` | 取回离线传输内容 |
| DELETE | `/api/transfer/:code` | 立即删除离线传输 |
| GET | `/api/transfer/:code/file/:key` | 下载离线文件（支持 Range） |
| POST | `/api/rtc` | 创建 P2P 信令房间 → 返回提取码 |
| GET | `/api/rtc/:code` | 轮询信令状态 |
| POST | `/api/rtc/:code/offer` | 发送方提交 SDP offer |
| POST | `/api/rtc/:code/answer` | 接收方提交 SDP answer |
| POST | `/api/rtc/:code/candidate` | 提交 ICE candidate |
| DELETE | `/api/rtc/:code` | 关闭信令房间 |

> 在线直传原理：浏览器 WebRTC 点对点直连，信令仅中转 SDP / ICE 不承载内容；文件 / 文本只在两台设备间传输，服务器不落盘。

</details>

---

## 🤝 贡献

欢迎通过 GitHub Issues 提交工具想法或反馈问题，也欢迎 Pull Request 贡献新工具或修复。

- 提交 Issue：[新建 Issue](https://github.com/lsx-xyg/tools/issues/new)
- 提交 PR：Fork 仓库后创建分支，确保 `npm run build` 通过后提交

---

## 📄 License

[MIT](LICENSE) © 2026 lsx-xyg
