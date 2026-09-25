# 工具箱 TOOLBOX

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

在线工具箱：25 个即开即用的小工具，无需注册登录，纯本地计算或到期自动销毁。
部署在 **Cloudflare Workers**（Next.js + OpenNext Cloudflare 适配器 + KV + R2），
可自行部署、按需扩展新工具。

## ✨ 特性

- **25 个即开即用的小工具**：文本 / 文件互传、二维码生成 / 解析、JSON 格式化、Base64、
  Cron 解析、格式互转、时间戳、Hash、UUID、Diff、正则、URL 编码、JWT、图片
  处理、徽章生成、Markdown 编辑器、PDF 处理等（见下方完整清单）。
- **在线直传（P2P）**：WebRTC 数据通道在设备间直传文本 / 文件，服务器只中转
  建连信令（SDP / ICE），**内容不经过、不存储在任何服务器**；凭 6 位提取码或扫码连接。
- **离线暂存**：内容暂存云端，保留时长（1h / 6h / 24h / 3 天 / 7 天）与下载次数
  （1 / 3 / 10 / 100 次）均可自定义，到期自动清除，凭提取码或扫码取回。
- **隐私优先**：绝大多数工具纯本地运行，内容不上传服务器。
- **存储后端可切换**：KV ↔ Redis（Upstash REST）一键切换，密码保护。
- **三态主题**：跟随系统 / 浅色 / 深色，实时响应系统变化，跨标签页同步。
- **全站密码门**：可选部署。密码存环境变量，验证后写入 30 天 HttpOnly Cookie，
  适合个人 / 小圈子私有部署，控制免费额度消耗。
- **移动端友好**：抽屉菜单 + 底部触控优化，响应式适配到窄屏。

## 🧰 工具清单

| 编号 | 工具 | 说明 |
| --- | --- | --- |
| T-01 | 文本 / 文件互传 | 在线 P2P 直传（不落服务器）· 离线暂存（时长 / 次数可自定义）· 提取码 / 扫码 |
| T-02 | 二维码生成 / 解析 | 文本/链接转二维码（尺寸颜色可调、PNG下载），或上传二维码图片解析内容 |
| T-03 | Base64 编码 | 双向转换，UTF-8 安全（中文 / emoji 不乱码） |
| T-04 | JSON 格式化 | 格式化 / 校验 / 压缩，报错定位到具体行 |
| T-05 | Cron 表达式 | 5 / 6 段解析，预览未来执行时间，校验合法性，可视化生成 |
| T-06 | 格式互转 | YAML / XML / CSV / INI / TOML / Properties ↔ JSON 双向互转 |
| T-07 | 时间戳转换 | Unix ↔ 日期时间，自动识别秒 / 毫秒，实时当前时间戳 |
| T-08 | Hash 计算 | MD5 / SHA-1 / SHA-256 / SHA-512，支持 HMAC 签名 |
| T-09 | UUID 生成 | 批量 v4，大写 / 无横线格式 |
| T-10 | 文本 Diff 对比 | 行级差异高亮，增删统计 |
| T-11 | 正则测试器 | 实时匹配高亮，捕获组查看，g / i / m / s 标志 |
| T-12 | 文本处理合集 | 大小写 / 排序 / 去重 / 提取等十余种操作，可叠加管线 |
| T-13 | URL 编码 / 解码 | encodeURIComponent 安全转换，中文 / emoji 安全 |
| T-14 | JWT 解析 / 生成 | 解码、HS / RS / ES / PS 签名验证与生成，多密钥类型 |
| T-15 | 文件哈希校验 | 拖拽即算 MD5 / SHA 摘要，本地完成 |
| T-16 | 设备信息 | 屏幕 / 系统 / 浏览器 / 网络环境，实时刷新 |
| T-17 | Case converter | 10 种大小写与命名风格转换 |
| T-18 | MIME types | 类型 ↔ 扩展名互查，模糊搜索 |
| T-19 | HTTP 状态码 | 62 条状态码速查：数字、英文名、中文含义 |
| T-20 | PDF 处理 | 多 PDF 合并 / 按页拆分提取，本地完成 |
| T-21 | 图片处理 | 压缩 / 缩放 / 裁剪 / 格式转换，canvas 本地渲染 |
| T-22 | 徽章生成 | shields.io 风格徽章，在线渲染，预设/hex 颜色 + Simple Icons Logo |
| T-23 | Markdown 编辑器 | 实时预览 · 代码高亮 · 多主题 · 转 HTML / 导出 PDF |
| T-25 | WebSocket / SSE 测试 | 连接 ws/wss 收发消息·SSE 流式订阅（GET/POST、自定义 Headers），实时时间线日志 |
| T-24 | 请求头解析 | 7 Tab：完整 HTTP 请求原文自动分离（请求行/Headers/Body）+ UA/Cookie/URL/Query/Header/Set-Cookie 结构化解析，Body 支持 JSON/XML/HTML 格式化高亮 + Form Data/Multipart 三列展示 |

> 新增工具 = 新建页面 + 在 `lib/tools.ts` 注册一项，自动出现在侧边栏、搜索与仪表台
> （见下方「如何新增一个工具」）。

## 🛠 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 16（App Router）+ TypeScript + 自研 CSS 设计系统 |
| 图标 / 组件 | lucide-react + shadcn/ui 风格 Button（Radix + cva + clsx + tailwind-merge） |
| 代码高亮 | Prism.js（JSON / XML / HTML / Markdown / Bash 等 16 种语言，三套主题） |
| 运行时 | Cloudflare Workers（`@opennextjs/cloudflare` 适配器） |
| 存储 | KV（传输记录 + P2P 信令）、R2（离线文件对象）；可选 Redis（Upstash REST） |
| 主题 | 三态（跟随系统 / 浅色 / 深色），`localStorage` 持久化 + matchMedia 实时监听 |

## 🚀 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
```

本地开发时后端自动使用内存 KV + `.local-store/` 目录模拟 KV / R2，可完整跑通
发送 / 接收流程（包括双开两个浏览器标签页测试在线直传）。

## ☁️ 部署到 Cloudflare Workers

### 1. 准备账号与资源

```bash
npx wrangler login

# 创建 KV 命名空间，把返回的 id 填入 wrangler.jsonc 的 TRANSFER_KV.id
npx wrangler kv namespace create TRANSFER_KV

# 创建 R2 存储桶（名字与 wrangler.jsonc 中一致）
npx wrangler r2 bucket create tools-transfer
```

### 2. KV namespace id：仓库只存占位符

`wrangler.jsonc` 中的 KV id 是占位符（`TRANSFER_KV_ID_PLACEHOLDER`），**真实 id 永远
不入库**，公开仓库也不泄露。部署时通过环境变量 / Secret 注入：

- **本地部署**（推荐入口，自动注入 id 并部署）：

  ```bash
  TRANSFER_KV_ID=<你的id> ./scripts/deploy.sh
  # 查 id：npx wrangler kv namespace list
  ```

- **GitHub Actions**：在仓库 Settings → Secrets 添加 `TRANSFER_KV_ID`，workflow 会
  在部署前自动替换占位符（见 `.github/workflows/deploy.yml`）。

> 也可以手动临时替换后部署：`sed "s/TRANSFER_KV_ID_PLACEHOLDER/<你的id>/" wrangler.jsonc > /tmp/w.jsonc && npx wrangler deploy -c /tmp/w.jsonc`

### 3. 设置全站访问密码（可选，推荐）

全站在 Worker 层做密码保护：未验证一律返回极简密码页，验证通过后写入 **30 天
有效 HttpOnly Cookie**（SameSite=Lax，HTTPS 下带 Secure）。密码**只存在环境变量，
不写死在代码**：

```bash
# 生产：把密码设为 secret（部署前执行）
npx wrangler secret put SITE_PASSWORD
```

> ⚠️ **未设置 `SITE_PASSWORD` 时全站拒绝访问**（安全兜底，不会裸奔）。
> 本地开发：`npx wrangler dev --var SITE_PASSWORD:你的密码`。
> 若不需要密码门，删除 `wrangler.jsonc` 中 `main` 的 `worker-auth.ts` 引用并恢复
> 默认入口即可。

### 4. 配置 R2 生命周期（建议，物理清理兜底）

业务层已按 TTL 判断过期（返回 410），但 R2 对象本身没有原生 TTL——上线后请给桶配
一条生命周期规则（控制台 → R2 → `tools-transfer` → 设置 → 生命周期规则）：

- 规则类型：**删除对象**
- 条件：**对象上传时间早于 7 天前**

### 5. 部署

```bash
npm run deploy
```

部署完成后访问 `https://tools.<你的子域>.workers.dev`。

### 6.（可选）GitHub Actions 自动部署

推送 `main` 分支即自动构建并部署（见 `.github/workflows/deploy.yml`）。
在仓库 Settings → Secrets 中添加：

- `CLOUDFLARE_API_TOKEN`（有 Workers 脚本与 KV / R2 写权限的 API Token）
- `CLOUDFLARE_ACCOUNT_ID`（Cloudflare 账号 ID）
- `TRANSFER_KV_ID`（你的 KV namespace id，见上文步骤 2）

## 🔄 存储后端切换（KV / Redis）

默认使用 Cloudflare KV；可一键切到 Redis（Upstash），用于降低 KV 免费额度消耗或做
信令加速。

- **为什么是 Upstash REST**：Cloudflare Workers 免费计划没有 TCP 出站
  （`connect()` 仅付费），Upstash 提供 HTTPS REST 接口（标准 Redis 命令走 URL），
  免费计划可直接调用。
- **启用 Redis**：部署环境变量配置两个值后，仪表台底部「存储后端 · 管理员」卡片
  即可切换：
  - `REDIS_URL`：Upstash REST 端点，如 `https://xxx.upstash.io`
  - `REDIS_TOKEN`：Upstash 访问令牌
- **切换密码**：优先读环境变量 `STORAGE_SWITCH_PASSWORD`；未配置时可在网页首次
  「设置密码」（≥6 位，SHA-256 哈希存绑定 KV）。切换后端必须输入正确密码。
- 切换 Redis 后：P2P 信令与离线传输元数据都走 Redis；离线**文件内容仍存 R2**。
- 未配置 REDIS_URL / REDIS_TOKEN 时切换会返回明确错误（防止伪切换）。

## 📡 API 一览

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
| POST | `/api/rtc/:code/candidate` | 提交 ICE candidate（body `{ role, sdp, seq }`） |
| DELETE | `/api/rtc/:code` | 关闭信令房间 |
| GET | `/api/settings/storage` | 查询存储后端（kv / redis）与密码状态 |
| POST | `/api/settings/storage` | 切换后端 / 设置修改密码 |

> 在线直传原理：浏览器 WebRTC 点对点直连，信令仅中转 SDP / ICE 不承载内容；
> 文件 / 文本只在两台设备间传输，服务器不落盘。

## ⚖️ 限额

- 文本：≤ 200,000 字符
- 文件：单次 ≤ 10 个、单个 ≤ 10 MB、总量 ≤ 50 MB
- 离线保留时长：1h / 6h / 24h / 3 天 / 7 天（服务端 clamp）
- 文件下载次数：1 / 3 / 10 / 100 次（服务端 clamp 到 1～100）
- P2P 信令窗口 15 分钟；连接超时 90 秒

## ⚠️ 已知限制

- 在线直传依赖 NAT 穿透（内置 Cloudflare STUN + 备用 STUN，**不含 Google**）。
  同一局域网 / WiFi 下主要靠 host candidate 直连；跨网络对称 NAT 无法穿透时需要
  自建 TURN，此时请改用离线模式。若同 WiFi 也无法直连，请检查路由器 AP / 客户端
  隔离、iOS「本地网络」权限、以及是否在微信内置浏览器中打开。
- 离线传输内容为明文暂存，到期自动销毁，不保证对抗取证级安全。
- KV 为最终一致性，跨地区信令偶尔可能延迟数百毫秒到数秒，客户端按字段增量消费、
  本地去重。

## 🛠 如何新增一个工具

1. 新建页面 `app/tools/<slug>/page.tsx`（参考现有工具，纯本地工具无需后端）。
2. 在 `lib/tools.ts` 注册一项：`id`、`name`、`tagline`、`description`、`path`、
   `icon`（`components/icon-map.ts` 中已定义或新增）、`tags`。
3. 侧边栏、搜索面板（Ctrl / ⌘ + K）、仪表台自动出现该工具。

## 📜 License

[MIT](LICENSE) © 2026 lsx-xyg

欢迎通过 GitHub Issues 提交工具想法或反馈问题。
