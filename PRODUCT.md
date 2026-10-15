# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js（App Router + TypeScript），经 `@opennextjs/cloudflare` 适配器部署到 Cloudflare Workers；KV 存传输记录，R2 存文件。用户已确认选择 Next.js。开发期（`next dev`）使用本地文件存储兜底，生产环境使用 KV/R2 绑定。

## Users

中文互联网用户，需要在手机、电脑、平板之间临时互传文本或小文件的普通人；无需注册登录，即开即用。假定（未逐一确认）：界面以中文为主，品牌词中英文并存；受众包含开发者与普通用户。

## Product Purpose

在线工具箱：一个可不断添加小工具的站点，当前已有 37 个工具（T-01 文本/文件互传 ～ T-37 Excel 函数快查），见 `lib/tools.ts` 注册清单。核心工具「文本/文件互传」：发送端输入文本或上传文件后获得 6 位提取码，接收端输入提取码或扫码即可取回；支持 WebRTC 点对点在线直传（内容不落服务器）与离线暂存（保留时长 / 下载次数可自定义，到期自动销毁）。第二批（T-29~T-36）新增：音频处理、媒体信息、视频抽帧/倍速、图片批量处理、录制、OCR、IP/DNS 查询，其中音视频处理复用 ffmpeg.wasm 在浏览器本地完成，OCR 复用 PaddleOCR.js（PixPin 同源引擎）本地识别，中文更准，支持图片、PDF 与 Word(docx)，IP/DNS 走外部免费接口；录制支持录制中实时预览与移动端 getDisplayMedia 兼容提示；DNS 查询对不可达源自动容错，并识别 Cloudflare CNAME 压平与代理 IP。T-37 Excel 函数快查：内置 63 个常用函数，列表页分类展示（常用置顶、支持搜索），详情页含语法、参数、示例与可交互迷你模拟器（VLOOKUP 等带模拟表实时高亮）；全站样式已接入主题 CSS 变量（明暗主题完整适配），详情页排版优化（参数表对齐、示例对比、模拟器触控与焦点态）。T-20 PDF 工具箱：一站式 PDF 处理：合并、按范围提取与每 N 页拆分、逐页旋转（含智能方向检测与全屏大预览）、压缩瘦身、PDF 转 JPG/PNG、图片合并转 PDF（严格按所选纸张 A4 出页，支持缩略图拖拽排序与逐图 90° 旋转）、删页与重排、添加页码、文字水印、密码加密与解密。全部在浏览器本地处理，文件不上传。各 Tab 上传文件后统一复用共享文件列表组件 `components/pdf/pdf-file-list.tsx`（PdfFileList）：首屏缩略图预览（PDF 用 pdfjs 渲染首页、图片直接显示）、点击放大模态（Ctrl/Cmd+滚轮或按钮缩放、多页 PDF 可翻页、Esc/背景关闭）、逐文件 90° 旋转（旋转记录在文件项并真实作用于业务输出：合并/拆分/压缩/加密/页码/水印/转图片均按旋转后字节处理，转图片经 viewport 旋转渲染）、拖拽排序 + 上移下移、移除；页面级工具（旋转 / 删页重排）复用同一放大预览模态 PdfViewerModal。样式全部走主题 CSS 变量，移动端网格自适应。原 T-38 PDF 自动旋转不再作为独立工具：其能力已并入 PDF 工具箱·旋转 Tab（智能方向检测、逐页独立旋转、全屏大预览、批量下载）；旧路由 /tools/pdf-auto-rotate 保留并重定向到 /tools/pdf?tab=rotate。全站上传/拖入入口统一复用 FileDropZone 组件（「拖入文件，或点击选择文件」横排样式，真实拖放 + 键盘可达）。首页仪表阵列支持常用排序：按点击次数自动前置常用工具，「常用管理」面板可置顶/取消置顶、一键清空计数（纯前端 localStorage，无埋点、不上报）。

## Positioning

与网盘、聊天软件的传输方式不同：无账号、无安装、仅凭 6 位提取码跨设备取回，24 小时自动销毁，专为「一次性、临时、跨设备」传递设计。

## Operating Context

用户在两台设备间切换操作；发送端可能是手机或电脑，接收端通常扫码或手动输入提取码。典型场景：临时文本（密码、地址、代码片段、长文）、小文件的快速搬运。

## Capabilities and Constraints

- 文本传输：≤ 200,000 字符。
- 文件传输（离线暂存）：单次 ≤ 10 个文件、单个 ≤ 200 MB、总量 ≤ 200 MB；在线 P2P 直传限制更宽松：单次 ≤ 10 个、单个 ≤ 4 GB、总量 ≤ 8 GB（分片发送，不走服务器存储）。
- 离线保留时长可自定义：1h / 6h / 24h / 3 天 / 7 天；下载次数可自定义：1 / 3 / 10 / 100（服务端 clamp）。
- 提取码：6 位数字，内容到期自动销毁。
- 在线直传：WebRTC P2P，服务器仅中转信令（SDP/ICE），内容不落盘；NAT 穿透依赖 host candidate（不含 Google STUN）。
- 部署：Cloudflare Workers 免费额度 + KV + R2，可选 Redis（Upstash REST）切换存储后端。
- 全站密码门（可选）：密码存环境变量 SITE_PASSWORD，验证后 30 天 HttpOnly Cookie。
- 传输内容为明文暂存，到期自动销毁，不保证对抗取证级安全。

## Brand Commitments

仓库名 `tools`；站点中文名「工具箱 TOOLBOX」；GitHub 仓库 https://github.com/lsx-xyg/tools（MIT 开源，准备公开）；无独立 logo，品牌资产为「精密仪器台」设计系统。

## Evidence on Hand

参考站 easychuan.cn（2026-09-24 抓取）：提供文件 / 文本 / 屏幕 / 视频四类互传；区分在线传输与离线传输（离线 = 云端存 24h + 10 次下载）；支持拖拽上传，单次最多 10 个文件。无真实用户内容与素材。

## Product Principles

1. 即开即用：无登录、无安装、路径最短，三步内完成一次传递。
2. 隐私友好：内容到期自动销毁，不做长期留存。
3. 一个工具一个页面：菜单化组织，新工具 = 新页面 + 新菜单项。
4. 现代、舒适、克制的视觉；所有操作有即时、清晰的反馈。
5. 免费额度内可运行（Workers / KV / R2 free tier）。

## Accessibility & Inclusion

假定（未逐一确认）：对比度满足 WCAG AA、全程键盘可操作、支持 prefers-reduced-motion。
