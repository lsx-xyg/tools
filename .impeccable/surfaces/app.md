---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface brief — 工具箱全站

## Scope & Visitor Mode

全站壳（导航 + 首页 + 工具页框架），Operate 模式为主，首页带轻量发现（Persuade）元素。当前 20 个工具页（T-01 文本/文件互传 ～ T-20 PDF 处理），注册于 `lib/tools.ts`。

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

**FIRST VIEWPORT**：品牌行 + 主题切换；仪表阵列（工具卡片带状态灯与编号读数），互传工具作为第一台仪表置前；下方一行「在线 P2P 直传 · 到期自动清除 · 免登录 · 免费」。

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
