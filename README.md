# 工具箱 TOOLBOX

在线工具箱：跨设备文本 / 文件互传等小工具，即开即用、无需登录，内容到期自动销毁。
部署在 **Cloudflare Workers**（Next.js + OpenNext Cloudflare 适配器 + KV + R2）。

## 功能

- **文本 / 文件互传（T-01）**
  - **在线直传（P2P）**：WebRTC 数据通道在两台设备间直传文本或文件，服务器只中转建立连接的信令（SDP/ICE），**文件内容不经过、不存储在任何服务器**；凭 6 位提取码或扫码连接。
  - **离线暂存**：内容暂存云端，可自定义保留时长（1h / 6h / 24h / 3 天 / 7 天）与文件下载次数（1 / 3 / 10 / 100 次），到期自动清除；凭提取码或扫码取回。
- 菜单化「仪表台」架构：新增工具 = 新增页面 + 在 `lib/tools.ts` 注册一项。
- 浅色 / 深色双主题（跟随系统，可手动切换），移动端抽屉菜单。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 16（App Router）+ TypeScript + 自研 CSS 设计系统（无 UI 框架） |
| 运行时 | Cloudflare Workers（`@opennextjs/cloudflare` 适配器） |
| 存储 | KV（传输记录 + P2P 信令）、R2（离线文件对象） |
| 二维码 | qrcode.react |

## 本地开发

```bash
npm install
npm run dev        # http://localhost:3000
```

本地开发时后端自动使用内存 KV + `.local-store/` 目录模拟 KV/R2，完整跑通发送/接收流程（包括双开两个浏览器标签页测试在线直传）。

## 部署到 Cloudflare Workers

### 1. 准备账号与资源

```bash
npx wrangler login

# 创建 KV 命名空间，把返回的 id 填入 wrangler.jsonc 的 TRANSFER_KV.id
npx wrangler kv namespace create TRANSFER_KV

# 创建 R2 存储桶（名字与 wrangler.jsonc 中一致）
npx wrangler r2 bucket create tools-transfer
```

### 2. 配置 wrangler.jsonc

打开 `wrangler.jsonc`，将 `kv_namespaces[0].id` 替换为上面创建返回的 id。

### 2b. 配置 R2 生命周期（建议，物理清理兜底）

业务层已按 TTL 判断过期（返回 410），但 R2 对象本身没有原生 TTL——
**如果过期后无人再访问该提取码，文件对象会一直残留在桶里**。上线后请给桶配一条
生命周期规则（控制台 → R2 → `tools-transfer` → 设置 → 生命周期规则，或调用 R2 Lifecycle API）：

- 规则类型：**删除对象**
- 条件：**对象上传时间早于 7 天前**（`created before: 7 days ago`）

这样 KV 记录 24h（或用户自定义时长）过期、应用层主动删除之外的漏网对象，
最迟 7 天被物理清除。

### 3. 部署

```bash
npm run deploy
```

部署完成后访问 `https://tools.<你的子域>.workers.dev`。

### 4.（可选）GitHub Actions 自动部署

把仓库推到 GitHub 后，在仓库 Settings → Secrets 中添加：

- `CLOUDFLARE_API_TOKEN`（有 Workers 脚本与 KV/R2 写权限的 API Token）
- `CLOUDFLARE_ACCOUNT_ID`（Cloudflare 账号 ID）

推送 `main` 分支即自动构建并部署（见 `.github/workflows/deploy.yml`）。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | Next.js 构建 |
| `npm run lint` | ESLint 检查 |
| `npm run preview` | 构建并本地预览 Cloudflare Worker |
| `npm run deploy` | 构建并部署到 Cloudflare |

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
| POST | `/api/rtc/:code/candidate` | 提交 ICE candidate（body `{ role, sdp, seq }`，seq 为单调递增序号） |
| DELETE | `/api/rtc/:code` | 关闭信令房间 |
| GET | `/api/settings/storage` | 查询存储后端（kv/redis）与密码状态 |
| POST | `/api/settings/storage` | 切换后端 / 设置修改密码（见下方「存储后端切换」） |

> 在线直传原理：浏览器 WebRTC 点对点直连，信令仅中转 SDP/ICE 不承载内容；
> 文件/文本只在两台设备间传输，服务器不落盘。

## 存储后端切换（KV / Redis）

默认使用 Cloudflare KV；可一键切到 Redis（Upstash），用于降低 KV 免费额度消耗或做信令加速。

- **为什么是 Upstash REST**：Cloudflare Workers 免费计划没有 TCP 出站（`connect()` 仅付费），
  Upstash 提供 HTTPS REST 接口（标准 Redis 命令走 URL），免费计划可直接调用。
- **启用 Redis**：部署环境变量配置两个值后，首页「存储后端 · 管理员」卡片即可切换：
  - `REDIS_URL`：Upstash REST 端点，如 `https://xxx.upstash.io`
  - `REDIS_TOKEN`：Upstash 访问令牌
- **切换密码**：优先读环境变量 `STORAGE_SWITCH_PASSWORD`（可直接配置）；
  未配置时可在网页首次「设置密码」（≥6 位，SHA-256 哈希存绑定 KV 的 `config:storage_password`）。
  切换后端必须输入正确密码。
- **开关存储位置**：`config:storage`（值 `kv`/`redis`）存在绑定 KV 中，带 30s 模块缓存；
  密码与开关不随后端切换变化，始终可读。
- 切换 Redis 后：P2P 信令与离线传输元数据都走 Redis；离线**文件内容仍存 R2**（Redis 不适合存大文件）。
- 未配置 REDIS_URL/REDIS_TOKEN 时切换到 Redis 会返回明确错误（防止伪切换）。

## 限额

- 文本：≤ 200,000 字符
- 文件：单次 ≤ 10 个、单个 ≤ 10 MB、总量 ≤ 50 MB
- 离线保留时长可自定义：1h / 6h / 24h / 3 天 / 7 天（服务端 clamp 到该范围）
- 文件下载次数可自定义：1 / 3 / 10 / 100 次（服务端 clamp 到 1～100）
- P2P 信令窗口 15 分钟；连接超时 90 秒

## 已知限制

- 在线直传依赖 NAT 穿透（内置 Cloudflare STUN + 备用 STUN，**不含 Google**）。
  同一局域网 / WiFi 下主要靠 host candidate 直连；跨网络对称 NAT 无法穿透时
  需要自建 TURN，此时请改用离线模式。若同 WiFi 也无法直连，请检查
  路由器 AP/客户端隔离、iOS「本地网络」权限、以及是否在微信内置浏览器中打开。
- 离线传输内容为明文暂存，到期自动销毁，不保证对抗取证级安全。
- KV 为最终一致性，跨地区信令偶尔可能延迟几百毫秒到数秒，客户端按字段增量消费、本地去重。

## 路线图

- [ ] 二维码生成
- [ ] JSON 格式化 / 校验
- [ ] 更多小工具（见首页「筹备中」模块）

欢迎通过 GitHub Issues 提工具想法。
