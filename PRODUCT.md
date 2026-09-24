# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js（App Router + TypeScript），经 `@opennextjs/cloudflare` 适配器部署到 Cloudflare Workers；KV 存传输记录，R2 存文件。用户已确认选择 Next.js。开发期（`next dev`）使用本地文件存储兜底，生产环境使用 KV/R2 绑定。

## Users

中文互联网用户，需要在手机、电脑、平板之间临时互传文本或小文件的普通人；无需注册登录，即开即用。假定（未逐一确认）：界面以中文为主，品牌词中英文并存；受众包含开发者与普通用户。

## Product Purpose

在线工具箱：一个可不断添加小工具的站点。首个工具为「文本/文件互传」：发送端输入文本或上传文件后获得 6 位提取码，接收端输入提取码即可取回内容。内容 24 小时后自动清除，文件最多可下载 10 次。交互模式参考 easychuan.cn。

## Positioning

与网盘、聊天软件的传输方式不同：无账号、无安装、仅凭 6 位提取码跨设备取回，24 小时自动销毁，专为「一次性、临时、跨设备」传递设计。

## Operating Context

用户在两台设备间切换操作；发送端可能是手机或电脑，接收端通常扫码或手动输入提取码。典型场景：临时文本（密码、地址、代码片段、长文）、小文件的快速搬运。

## Capabilities and Constraints

- 文本传输：≤ 200,000 字符。
- 文件传输：单次 ≤ 10 个文件、单个 ≤ 10 MB、总量 ≤ 50 MB（假定，可调整）。
- 有效期 24 小时；文件下载次数 ≤ 10（假定，对齐参考站）。
- 提取码：6 位数字，内容到期自动销毁。
- 部署：Cloudflare Workers 免费额度 + KV + R2。
- 未定：登录态（v1 不做）、传输内容加密（v1 明文，注明风险）。

## Brand Commitments

仓库名 `tools`；站点中文名「工具箱」（假定）；无已确认的 logo 或品牌资产。

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
