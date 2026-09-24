# 工具箱 TOOLBOX

在线工具箱：跨设备文本 / 文件互传等小工具，即开即用、无需登录，内容到期自动销毁。
部署在 **Cloudflare Workers**（Next.js + OpenNext Cloudflare 适配器 + KV + R2）。

## 功能

- **文本 / 文件互传（T-01）**
  - **在线直传（P2P）**：WebRTC 数据通道在两台设备间直传文本或文件，服务器只中转建立连接的信令（SDP/ICE），**文件内容不经过、不存储在任何服务器**；凭 6 位提取码或扫码连接。
  - **离线 24h**：内容暂存云端，24 小时自动清除；文件最多下载 10 次；凭提取码或扫码取回。
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
| POST | `/api/transfer` | 创建离线传输（JSON 文本或 multipart 文件）→ 返回提取码 |
| GET | `/api/transfer/:code` | 取回离线传输内容 |
| DELETE | `/api/transfer/:code` | 立即删除离线传输 |
| GET | `/api/transfer/:code/file/:key` | 下载离线文件（支持 Range 断点） |
| POST | `/api/rtc` | 创建在线 P2P 信令房间 → 返回提取码 |
| GET | `/api/rtc/:code` | 轮询信令状态 |
| POST | `/api/rtc/:code/offer` | 发送方提交 SDP offer |
| POST | `/api/rtc/:code/answer` | 接收方提交 SDP answer |
| POST | `/api/rtc/:code/candidate` | 提交 ICE candidate |
| DELETE | `/api/rtc/:code` | 关闭信令房间 |

## 限额

- 文本：≤ 200,000 字符
- 文件：单次 ≤ 10 个、单个 ≤ 10 MB、总量 ≤ 50 MB
- 离线保留 24 小时；文件下载 ≤ 10 次
- P2P 信令窗口 15 分钟；连接超时 90 秒

## 已知限制

- 在线直传依赖 NAT 穿透（内置 Google/Cloudflare STUN）。极少数严格 NAT/防火墙网络无法建立 P2P 直连，此时请改用离线 24h 模式。
- 离线传输内容为明文暂存，到期自动销毁，不保证对抗取证级安全。
- KV 为最终一致性，跨地区信令偶尔可能延迟几百毫秒到数秒，轮询已做版本去重。

## 路线图

- [ ] 二维码生成
- [ ] JSON 格式化 / 校验
- [ ] 更多小工具（见首页「筹备中」模块）

欢迎通过 GitHub Issues 提工具想法。
