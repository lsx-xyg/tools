---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface brief — 工具箱全站

## Scope & Visitor Mode

全站壳（导航 + 首页 + 工具页框架），Operate 模式为主，首页带轻量发现（Persuade）元素。当前 26 个工具页（T-01 ~ T-39 编号，部分编号因工具下架空缺），注册于 `lib/tools.ts`。T-33 录制为浏览器本地能力（录制中实时预览、移动端 getDisplayMedia 兼容提示，输出可选 MP4 / WebM，MP4 需 Chrome 126+ 否则自动回退 WebM）；T-34 OCR 复用 PaddleOCR.js（PixPin 同源引擎）本地识别；T-39 视频格式转换基于 ffmpeg.wasm 本地转 MP4 / WebM / MOV / MKV / GIF（MP4/MOV/MKV 互转无损 copy，WebM/GIF 转码）。T-37 Excel 函数快查：列表→详情两级结构，函数库在 `lib/excel-functions.ts`，详情页交互模拟器在 `components/excel-demo.tsx`（输入参数实时出结果，VLOOKUP/INDEX 等带模拟表高亮）；列表搜索在 `components/excel-search.tsx`（客户端）。全站样式接入主题 CSS 变量（明暗完整适配），详情页排版与触控焦点优化。T-20 PDF 工具箱：一站式 PDF 处理：合并、按范围提取与每 N 页拆分、逐页旋转（含智能方向检测与全屏大预览）、分级压缩（建议 / 低 / 中 / 高）、PDF 转 JPG/PNG、图片合并转 PDF（严格按所选纸张 A4 出页，缩略图拖拽排序 + 逐图 90° 旋转）、删页与重排、添加页码、文字水印、密码加密与解密。全部在浏览器本地处理，文件不上传。压缩为分级真实压缩（对齐 smallpdf 默认思路：不降分辨率、只重编码图片流）：「建议」档先无损重写，图片型 PDF 自动高保真重编码（2.0 倍率 ≈144dpi + 0.85 质量，视觉无损）并取更小者；低 / 中 / 高显式栅格化重建：低 1.5 倍率 ≈108dpi/0.85 接近无损、中 1.2 倍率 86dpi/0.75、高 1.0 倍率 72dpi/0.6 明显压缩但内容清晰。实测（1200×1600 大图 PDF）：auto 27%、低 48%、中 69%、高 82%。扫描件 / 图片 PDF 栅格化档效果最佳；文本型栅格化后文字不可选中、可能反而变大。各 Tab 上传文件后统一复用共享文件列表组件 `components/pdf/pdf-file-list.tsx`（PdfFileList）：首屏缩略图预览（PDF 用 pdfjs 渲染首页、图片上传即直接渲染）、点击放大模态（Ctrl/Cmd+滚轮或按钮缩放、多页 PDF 可翻页、Esc/背景关闭；缩略图与放大模态均真实反映旋转方向，90/270 按旋转后外接盒排布、无留白溢出）、逐文件 90° 旋转（旋转真实作用于业务输出：合并/拆分/压缩/加密/页码/水印/转图片均按旋转后字节处理）、拖拽排序 + 上移下移、移除；页面级工具（旋转 / 删页重排）复用同一放大预览模态 PdfViewerModal。样式全部走主题 CSS 变量，移动端网格自适应。全站上传/拖入入口统一复用 `components/drop-zone.tsx`（FileDropZone，「拖入文件，或点击选择文件」横排样式，真实拖放 + 键盘可达）。原 T-38 PDF 自动旋转不再作为独立工具页：其能力已并入 PDF 工具箱·旋转 Tab（智能方向检测、逐页独立旋转、全屏大预览、批量下载）；旧路由 /tools/pdf-auto-rotate 保留并重定向到 /tools/pdf?tab=rotate。首页仪表阵列按注册顺序平铺展示全部工具卡片（`components/home-console.tsx`）。侧边栏按用途分类分组平铺（`components/nav/grouped-nav.tsx` 的 `DesktopNav` / `MobileDrawerNav`：传输与分享 / 文档处理 / 文本处理 / 开发与编码 / 速查参考 / CI/CD 与发布 / 网络与调试 / 媒体工具八组，组标题带数量角标、同类工具集中，无悬浮浮层，桌面与移动端同构，工具多时可滚动）。

## Audience

中文互联网用户，在手机 / 电脑 / 平板之间临时互传文本或小文件；无登录、即开即用；含开发者用户。

## Job / Action / Task

打开站点 → 从菜单选择工具 → 完成一次跨设备互传（发送端获码 / 接收端取回）。三步内完成。

## Proof / Content

免登录、免费；离线暂存保留时长 / 下载次数可自定义、到期自动销毁；绝大多数工具纯本地运行。真实功能，不编造宣传。

## Constraints

菜单化架构，新增工具 = 新页面 + 新菜单项（自动进入侧边栏/搜索/仪表台）；运行在 Cloudflare Workers 免费额度（KV/R2，可选 Redis）；现代、克制、操作舒适；界面以中文为主，品牌词中英文并存；仓库 MIT 开源可自行部署。

## Direction contract

**THESIS**：工具箱是一台「精密仪器台」——每个工具是一台仪表，菜单是仪表阵列；拒绝「圆角卡片 + 图标 + 文案」的通用工具箱模板。

**OWN-WORLD**：暖白纸张底 + 炭墨文字 + 单一琥珀信号色（只出现在可操作与成功态）；细刻度线作分隔、蚀刻式小标签、tabular 等宽数字专用于编码读数；半径克制、阴影带偏移；深色模式 = 仪表台夜航（暖黑底 + 琥珀亮色）。

**STORY**：访客把站点当作一台可靠的精密仪器：每台工具都有状态指示灯（就绪 / 即将上线），任何操作都有即时的「亮灯」反馈；互传像在两台终端之间对表。

**FIRST VIEWPORT**：品牌行 + 主题切换；仪表阵列（工具卡片带状态灯与编号读数，按注册顺序排列），互传工具作为第一台仪表置前；下方一行「在线 P2P 直传 · 到期自动清除 · 免登录 · 免费」。

**FORM**：自研方向 #7（精密仪器台），种子 c5f6884b；code-led 构建（中文工具 UI 无法由图像模型忠实渲染，本会话以契约承载野心，不落盘 buildPath）。

**SIGNATURE INTERACTION**：提取码以翻牌（split-flap）级联动画揭示；成功态以信号灯 dim→lit 点亮反馈。

**FINISH**：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Raises（来自挑战者捐赠，写入方向）

- 状态必须同时携带文字/图标与颜色，颜色永不是唯一信号（cyclorama）。
- 每屏构图遵循单一主轴（deep-dive）。
- 控件反馈 dim→lit 亮灯（kraftwerk）。
- 琥珀色为保留色，只用于可操作/成功（arcade）。
- 提取码翻牌级联揭示（concourse）。
- 舒适底线：通俗中文标签、触控目标 ≥44px、单一行动色（consumer canon）。

## Unresolved

加密传输（v1 明文，标注）；是否需要登录态；后续工具清单未定。
