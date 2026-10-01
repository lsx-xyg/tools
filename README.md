# 工具箱 TOOLBOX

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare)](https://workers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![Deploy](https://github.com/lsx-xyg/tools/actions/workflows/deploy.yml/badge.svg)](https://github.com/lsx-xyg/tools/actions)

一个部署在 Cloudflare Workers 上的在线工具箱，包含 27 个即开即用的小工具，无需注册登录，纯本地计算或到期自动销毁。可自行部署、按需扩展新工具。

## 目录

- [安装](#安装)
- [使用](#使用)
- [工具清单](#工具清单)
- [技术栈](#技术栈)
- [配置](#配置)
- [部署到 Cloudflare Workers](#部署到-cloudflare-workers)
- [存储后端切换](#存储后端切换-kv--redis)
- [API 一览](#api-一览)
- [项目结构](#项目结构)
- [扩展开发](#扩展开发)
- [贡献](#贡献)
- [License](#license)

## 安装

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

访问 `http://localhost:3000`。本地开发时后端自动使用内存 KV + `.local-store/` 目录模拟 KV / R2，可完整跑通发送 / 接收流程（包括双开两个浏览器标签页测试在线直传）。

## 使用

打开网站后，通过左侧边栏或搜索（`Ctrl / ⌘ + K`）选择工具即可使用。大部分工具为纯前端计算，数据不离开浏览器；涉及传输的工具（T-01）支持在线 P2P 直传（内容不落服务器）与离线暂存（到期自动销毁）。

## 工具清单

| 编号 | 工具 | 说明 |
| --- | --- | --- |
| T-01 | 文本 / 文件互传 | 在线 P2P 直传（不落服务器）· 离线暂存（时长 / 次数可自定义）· 提取码 / 扫码 |
| T-02 | 二维码生成 / 解析 | 生成二维码或解析二维码图片 |
| T-03 | Base64 编码 | 编码 / 解码，中文安全 |
| T-04 | JSON 格式化 | 格式化 / 校验 / 压缩 |
| T-05 | Cron 表达式 | 解析下次执行时间，可视化生成 |
| T-06 | 格式互转 | YAML / XML / CSV / INI / TOML / Properties ↔ JSON |
| T-07 | 时间戳转换 | Unix 时间 ↔ 日期时间 |
| T-08 | Hash 计算 | MD5 / SHA 系列 / HMAC |
| T-09 | UUID 生成 | 批量 v4，本地随机 |
| T-10 | 文本 Diff 对比 | 两栏对比，差异高亮 |
| T-11 | 正则测试器 | 匹配预览与捕获组 |
| T-12 | 文本处理合集 | 大小写 / 排序 / 去重等 |
| T-13 | URL 编码 / 解码 | encodeURIComponent 安全转换 |
| T-14 | JWT 解析 / 生成 | 解码 / 签名验证 / 生成 |
| T-15 | 文件哈希校验 | 本地文件的 MD5 / SHA 摘要 |
| T-16 | 设备信息 | 屏幕 / 系统 / 浏览器环境 |
| T-17 | Case converter | 大小写与命名风格转换 |
| T-18 | MIME types | MIME ↔ 扩展名互查 |
| T-19 | HTTP 状态码 | 状态码速查 · 数字 / 英文 / 中文 |
| T-20 | PDF 处理 | 合并 / 拆分 / 提取页面 |
| T-21 | 图片处理 | 格式转换 / 压缩 / 缩放 / 裁剪 |
| T-22 | 徽章生成 | shields.io 风格徽章 |
| T-23 | Markdown 编辑器 | 实时预览 / 转 HTML / PDF |
| T-24 | 请求头解析 | UA / Cookie / URL / Query / Header / Set-Cookie |
| T-25 | WebSocket / SSE 测试 | 连接测试 · 收发消息 · 实时日志 |
| T-26 | Vercel 部署清理 | 批量删除旧部署 · 保留最新 N 个 |
| T-27 | GitHub Release 清理 | 批量删除旧 Release · 保留最新 N 个 · 可选删 Tag |

> 新增工具 = 新建页面 + 在 `lib/tools.ts` 注册一项，自动出现在侧边栏、搜索与仪表台（见[扩展开发](#扩展开发)）。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 16（App Router）+ TypeScript + Tailwind CSS + 自研 CSS 设计系统 |
| 图标 / 组件 | lucide-react + shadcn/ui 风格 Button（Radix + cva + clsx + tailwind-merge） |
| 代码高亮 | Prism.js（JSON / XML / HTML / Markdown / Bash 等多语言，多套主题） |
| 运行时 | Cloudflare Workers（`@opennextjs/cloudflare` 适配器） |
| 存储 | KV（传输记录 + P2P 信令）、R2（离线文件对象）；可选 Redis（Upstash REST） |
| 主题 | 三态（跟随系统 / 浅色 / 深色），`localStorage` 持久化 + matchMedia 实时监听 |
| 字体 | LxgwWenKai Screen（开源中文字体） |

## 配置

### 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `SITE_PASSWORD` | 推荐 | 全站访问密码。未设置时全站拒绝访问（安全兜底） |
| `TRANSFER_KV_ID` | 部署必需 | Cloudflare KV namespace id（通过 secret 或部署脚本注入，不入库） |
| `REDIS_URL` | 可选 | Upstash REST 端点，启用 Redis 存储后端时需要 |
| `REDIS_TOKEN` | 可选 | Upstash 访问令牌 |
| `STORAGE_SWITCH_PASSWORD` | 可选 | 存储后端切换密码；未配置时可在网页首次设置 |

### 限额

| 项目 | 限制 |
| --- | --- |
| 文本 | ≤ 200,000 字符 |
| 文件 | 单次 ≤ 10 个、单个 ≤ 10 MB、总量 ≤ 50 MB |
| 离线保留时长 | 1h / 6h / 24h / 3 天 / 7 天 |
| 文件下载次数 | 1 / 3 / 10 / 100 次 |
| P2P 信令窗口 | 15 分钟；连接超时 90 秒 |

## 部署到 Cloudflare Workers

### 1. 准备账号与资源

```bash
npx wrangler login

# 创建 KV 命名空间，把返回的 id 记下
npx wrangler kv namespace create TRANSFER_KV

# 创建 R2 存储桶（名字与 wrangler.jsonc 中一致）
npx wrangler r2 bucket create tools-transfer
```

### 2. 注入 KV namespace id

`wrangler.jsonc` 中的 KV id 是占位符（`TRANSFER_KV_ID_PLACEHOLDER`），真实 id 不入库。部署时通过环境变量注入：

```bash
TRANSFER_KV_ID=<你的id> ./scripts/deploy.sh
# 查 id：npx wrangler kv namespace list
```

或使用 GitHub Actions：在仓库 Settings → Secrets 添加 `TRANSFER_KV_ID`，workflow 会在部署前自动替换占位符。

### 3. 设置全站访问密码

```bash
npx wrangler secret put SITE_PASSWORD
```

> 未设置 `SITE_PASSWORD` 时全站拒绝访问。本地开发：`npx wrangler dev --var SITE_PASSWORD:你的密码`。

### 4. 配置 R2 生命周期（建议）

业务层已按 TTL 判断过期，但 R2 对象本身没有原生 TTL。请给桶配置生命周期规则（控制台 → R2 → `tools-transfer` → 设置 → 生命周期规则）：规则类型为删除对象，条件为对象上传时间早于 7 天前。

### 5. 部署

```bash
npm run deploy
```

部署完成后访问 `https://tools.<你的子域>.workers.dev`。

### 6. GitHub Actions 自动部署

推送 `main` 分支即自动构建并部署。在仓库 Settings → Secrets 中添加：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TRANSFER_KV_ID`

## 存储后端切换（KV / Redis）

默认使用 Cloudflare KV；可切换到 Redis（Upstash），用于降低 KV 免费额度消耗。

- 启用 Redis：配置 `REDIS_URL` 和 `REDIS_TOKEN` 环境变量后，仪表台底部「存储后端 · 管理员」卡片即可切换。
- 切换密码：优先读环境变量 `STORAGE_SWITCH_PASSWORD`；未配置时可在网页首次设置（≥6 位，SHA-256 哈希存绑定 KV）。
- 切换 Redis 后：P2P 信令与离线传输元数据走 Redis；离线文件内容仍存 R2。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/transfer` | 创建离线传输（JSON 文本或 multipart 文件；可选 `ttlHours`、`maxDownloads`）→ 返回提取码 |
| GET | `/api/transfer/:code` | 取回离线传输内容 |
| DELETE | `/api/transfer/:code` | 立即删除离线传输 |
| GET | `/api/transfer/:code/file/:key` | 下载离线文件（支持 Range 断点） |
| POST | `/api/rtc` | 创建在线 P2P 信令房间 → 返回提取码 |
| GET | `/api/rtc/:code` | 轮询信令状态 |
| POST | `/api/rtc/:code/offer` | 发送方提交 SDP offer |
| POST | `/api/rtc/:code/answer` | 接收方提交 SDP answer |
| POST | `/api/rtc/:code/candidate` | 提交 ICE candidate |
| DELETE | `/api/rtc/:code` | 关闭信令房间 |
| GET | `/api/settings/storage` | 查询存储后端与密码状态 |
| POST | `/api/settings/storage` | 切换后端 / 设置修改密码 |

> 在线直传原理：浏览器 WebRTC 点对点直连，信令仅中转 SDP / ICE 不承载内容；文件 / 文本只在两台设备间传输，服务器不落盘。

## 项目结构

```text
tools/
├── app/
│   ├── api/                    # API 路由（传输、信令、设置）
│   ├── tools/                  # 各工具页面（每个工具一个目录）
│   │   ├── transfer/           # T-01 文本/文件互传
│   │   ├── qr/                 # T-02 二维码
│   │   ├── json/               # T-04 JSON 格式化
│   │   ├── vercel-clean/       # T-26 Vercel 部署清理
│   │   └── github-release-clean/ # T-27 GitHub Release 清理
│   ├── globals.css             # 全站样式 + 设计系统
│   ├── layout.tsx              # 根布局（侧边栏 + 内容区）
│   └── page.tsx                # 仪表台首页
├── components/
│   ├── icons.tsx               # lucide 图标封装
│   ├── icon-map.ts             # 工具图标映射
│   ├── tool-head.tsx           # 工具页头部组件
│   └── ui/                     # shadcn 风格组件
├── lib/
│   ├── tools.ts                # 工具注册清单（T-01 ~ T-27）
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

## 扩展开发

### 新增一个工具

1. 新建页面 `app/tools/<slug>/page.tsx`（参考现有工具，纯本地工具无需后端）。
2. 在 `lib/tools.ts` 注册一项：`id`、`name`、`tagline`、`description`、`path`、`icon`（`components/icon-map.ts` 中已定义或新增）、`tags`。
3. 侧边栏、搜索面板（`Ctrl / ⌘ + K`）、仪表台自动出现该工具。

### 开发命令

```bash
npm run dev       # 本地开发
npm run build     # 构建（含 TypeScript 类型检查）
npm run lint      # ESLint 检查
npm run preview   # 本地预览 Cloudflare Workers 构建产物
```

## 贡献

欢迎通过 GitHub Issues 提交工具想法或反馈问题，也欢迎 Pull Request 贡献新工具或修复。

- 提交 Issue：[新建 Issue](https://github.com/lsx-xyg/tools/issues/new)
- 提交 PR：Fork 仓库后创建分支，确保 `npm run build` 通过后提交

## License

[MIT](LICENSE) © 2026 lsx-xyg
