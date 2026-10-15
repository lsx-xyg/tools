# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js（App Router + TypeScript），经 `@opennextjs/cloudflare` 适配器部署到 Cloudflare Workers；KV 存传输记录，R2 存文件。用户已确认选择 Next.js。开发期（`next dev`）使用本地文件存储兜底，生产环境使用 KV/R2 绑定。

## Users

中文互联网用户，需要在手机、电脑、平板之间临时互传文本或小文件的普通人；无需注册登录，即开即用。假定（未逐一确认）：界面以中文为主，品牌词中英文并存；受众包含开发者与普通用户。

## Product Purpose

在线工具箱：一个可不断添加小工具的站点，当前已有 26 个工具（T-01 ~ T-39 编号，其中 T-03/T-04/T-13/T-14/T-21/T-28~T-32/T-35/T-36 因工具下架空缺），见 `lib/tools.ts` 注册清单。核心工具「文本/文件互传」：发送端输入文本或上传文件后获得 6 位提取码，接收端输入提取码或扫码即可取回；支持 WebRTC 点对点在线直传（内容不落服务器）与离线暂存（保留时长 / 下载次数可自定义，到期自动销毁）。T-33 录制为浏览器本地能力：录制中实时预览、移动端 getDisplayMedia 兼容提示，输出格式可选 MP4（Chrome 126+ 原生录制，不支持自动回退 WebM）或 WebM；T-34 OCR 复用 PaddleOCR.js（PixPin 同源引擎）本地识别，中文更准，支持图片、PDF 与 Word(docx)；T-39 视频格式转换：基于 ffmpeg.wasm 本地把视频转 MP4 / WebM / MOV / MKV / GIF，MP4/MOV/MKV 互转优先无损封装（-c copy），WebM / GIF 重新编码。T-37 Excel 函数快查：内置 63 个常用函数，列表页分类展示（常用置顶、支持搜索），详情页含语法、参数、示例与可交互迷你模拟器（VLOOKUP 等带模拟表实时高亮）；全站样式已接入主题 CSS 变量（明暗主题完整适配），详情页排版优化（参数表对齐、示例对比、模拟器触控与焦点态）。T-20 PDF 工具箱：一站式 PDF 处理：合并、按范围提取与每 N 页拆分、逐页旋转（含智能方向检测与全屏大预览）、分级压缩（建议 / 低 / 中 / 高四档）、PDF 转 JPG/PNG、图片合并转 PDF（严格按所选纸张 A4 出页，支持缩略图拖拽排序与逐图 90° 旋转）；扫描件合成 Tab（T-20 新增能力）：混合上传图片(JPG/PNG/WebP)、PDF、Word(.docx)，全部栅格化为扫描件页（图片直渲、PDF 用 pdfjs 逐页白底渲染 144dpi、docx 用 mammoth→HTML→html2canvas 按 A4 高度切割分页），支持原色 / 灰度 / 黑白 / 纸面字迹（`applyPaperScan`：米黄纸底 #f5f0e2 + 灰度加深 multiply 叠字 + 步进 2px 噪点纸纹，维普报告式真实扫描观感）四种扫描效果，纸面字迹模式可叠加红色圆章（`drawSeal`：外圆/内圆/五角星，文字 ≤10 字居中两行、否则环形排列，盖在每页右下角，半透明微斜，位置/尺寸随页面缩放）、A4 或自适应页面、A4 方向、列表排序 / 逐项旋转 / 移除（docx 行显示文档图标占位、不可放大预览），最后按顺序合成一个 PDF；接入全局任务中心后台运行；实测图片+营业执照+docx 混合合成 3 页 A4，Word 文本栅格化完整、灰度生效、删页与重排、添加页码、文字水印、密码加密与解密。全部在浏览器本地处理，文件不上传。压缩为分级真实压缩（对齐 smallpdf 默认思路：不降分辨率、只重编码图片流）：「建议」档先无损重写，图片型 PDF 自动高保真重编码（2.0 倍率 ≈144dpi + 0.85 质量，视觉无损）并取更小者；低 / 中 / 高为显式栅格化重建，低 1.5 倍率 ≈108dpi/0.85 接近无损、中 1.2 倍率 86dpi/0.75、高 1.0 倍率 72dpi/0.6 明显压缩但内容清晰。实测（1200×1600 大图 PDF）：auto 瘦 27%、低 48%、中 69%、高 82%。扫描件 / 图片类 PDF 栅格化档效果最佳；文本型栅格化后文字不可选中、反而可能变大。各 Tab 上传文件后统一复用共享文件列表组件 `components/pdf/pdf-file-list.tsx`（PdfFileList）：首屏缩略图预览（PDF 用 pdfjs 渲染首页、图片上传即直接渲染，不再停留在占位图标）、点击放大模态（Ctrl/Cmd+滚轮或按钮缩放、多页 PDF 可翻页、Esc/背景关闭）、缩略图与放大模态均真实反映旋转方向（旋转 90/270 时按旋转后外接盒排布，无留白 / 溢出；图片分支按可视区 × zoom 反推外接盒）、逐文件 90° 旋转（旋转记录在文件项并真实作用于业务输出：合并/拆分/压缩/加密/页码/水印/转图片均按旋转后字节处理，转图片经 viewport 旋转渲染）、拖拽排序 + 上移下移、移除；页面级工具（旋转 / 删页重排）复用同一放大预览模态 PdfViewerModal。样式全部走主题 CSS 变量，移动端网格自适应。原 T-38 PDF 自动旋转不再作为独立工具：其能力已并入 PDF 工具箱·旋转 Tab（智能方向检测、逐页独立旋转、全屏大预览、批量下载）；旧路由 /tools/pdf-auto-rotate 保留并重定向到 /tools/pdf?tab=rotate。全站上传/拖入入口统一复用 FileDropZone 组件（「拖入文件，或点击选择文件」横排样式，真实拖放 + 键盘可达）。 拖拽上传全局防护（`lib/drop-guard.tsx` 的 DropGuardProvider，挂 `app/layout.tsx`）：window 级 dragenter/dragover/drop 监听拦截文件拖入默认行为（文件拖到非上传区不再被浏览器直接打开），拖到非 dropzone 区域显示全屏遮罩（文案取当前上传区 label，主题变量样式，pointer-events:none 不拦截事件），drop 后文件路由给最后注册的接收器（FileDropZone 挂载时经 useId 自动注册/注销，props 变化重注册）；dropzone 局部拖入走组件自身高亮与 onDrop（stopPropagation 避免 window 重复处理），仅含 Files 的拖拽才高亮/拦截（纯文本或链接拖入保持浏览器默认）；拖出窗口（relatedTarget null 或坐标出界）自动收起遮罩。OCR 页空状态已统一为 FileDropZone（预览态保留按钮更换与轻量拖拽替换）。首页仪表阵列按注册顺序平铺展示全部工具卡片。侧边栏按用途分类分组平铺（传输与分享 / 文档处理 / 文本处理 / 开发与编码 / 速查参考 / CI/CD 与发布 / 网络与调试 / 媒体工具，组标题带数量角标、同类工具集中），桌面与移动端同构，工具多时可滚动。 全局任务中心（`lib/task-center.tsx`）：模块级任务 store（createTask/updateTask/completeTask/failTask/removeTask/clearFinished/hasRunningTask/useTasks，useSyncExternalStore 订阅），`app/layout.tsx` 挂载 TaskCenter 常驻右下角——进行中任务显示进度条（视频转换走 ffmpeg setProgress、PDF 压缩按页栅格化进度）与折叠日志，完成后提供下载入口，失败显示原因，可移除/清除已完成；耗时任务（视频格式转换、PDF 压缩）提交后即进入后台，客户端导航切换工具不中断（整页刷新会中断，属会话级任务），按钮在有运行中任务时禁用并提示「可切走，见右下角任务中心」。

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
