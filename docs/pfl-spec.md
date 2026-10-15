# PDF 文件列表统一组件集成规范（subagent 必读）

## 背景
PDF 工具箱（app/tools/pdf）10 个 Tab 各自维护文件数组/列表 UI。现新建共享组件
`components/pdf/pdf-file-list.tsx`（已实现，**不要修改**），各 Tab 的文件管理 UI 一律替换为它。

## 共享组件 API（已实现，按此使用）

```tsx
import { PdfFileList, PdfViewerModal, type PdfFileItem, type PdfFileKind } from "@/components/pdf/pdf-file-list";

interface PdfFileItem {
  id: string;            // 稳定字符串 id（原数字 id 用 String(idRef.current++) 即可）
  kind: "pdf" | "image";
  name: string;
  file: File | Blob;
  bytes?: ArrayBuffer;   // pdf 类型建议预读存储；缺省组件会自行 arrayBuffer
  pages?: number;
  rotation: number;      // 0|90|180|270，由组件旋转按钮递增；业务输出时必须读取
  extra?: string;        // 附加元信息行（如压缩前后体积、图片尺寸）
}
// Tab 可以定义扩展类型：type MyRow = PdfFileItem & { width: number; ... }，组件只读基类字段，透传整个数组

<PdfFileList
  items={items}
  onChange={setItems}      // 组件内部 排序/旋转/移除 变更都通过 onChange 回传新数组（受控组件）
  disabled={busy}
/>

// 页面级工具（rotate / organize）的放大预览模态：
<PdfViewerModal
  open={!!viewer}
  onClose={() => setViewer(null)}
  title={...}
  kind="pdf"
  bytes={...}              // 或 blob
  pageCount={...}
  pageIndex={...}
  onPageChange={(i) => ...}
  rotation={...}           // 当前页旋转角（逐页）
  actions={<>…逐页旋转/下载按钮…</>}   // 头部附加按钮，可空
  disabled={busy}
/>
```

## 旋转必须真实作用到业务输出
- 整文件旋转：`import { rotatePdfBytes } from "@/lib/pdf-utils"` → `const rotated = await rotatePdfBytes(bytes, item.rotation)`，
  再对 rotated 执行本 Tab 的业务（mergePdfs / compressPdf / encryptPdf / addPageNumbers / addWatermark / extractPages / splitByN …）。
  rotation===0 时 rotatePdfBytes 原样返回 bytes，可放心无条件调用。
- 转图片：`pdfToImages(bytes, { scale, format, quality, rotation: item.rotation })`（已支持 rotation 参数）。
- 图片转 PDF：imagesToPdf 每个图片传 `rotation: item.rotation`（已有）。
- 页数/大小等元信息不受旋转影响。

## 硬约束
- **不要修改**：`components/pdf/pdf-file-list.tsx`、`lib/pdf-utils.ts`（已含 rotatePdfBytes / pdfToImages rotation）、
  `app/globals.css`（已含 .pfl-* 全部样式）、`components/drop-zone.tsx`、`app/tools/pdf/page.tsx`、app/tools/ocr/。
- 只改你被分配的 Tab 文件。每个 Tab 保留自身业务逻辑（解析、选项、按钮、下载命名、错误处理），
  只替换「文件数组 + 列表渲染 + 排序/旋转/移除 UI」为 PdfFileList。
- 样式：只使用 globals.css 已有主题变量（--bg-subtle/--line/--ink/--ink-2/--accent/--accent-strong/--accent-soft/--bg-elev/--err 等）
  与既有类（.btn-icon/.count-hint/.tool-row/.vc-*/.pfl-*），**严禁手写颜色值**。
- 移动端适配不破：不要写固定 px 宽度容器。
- 不再使用的 import（IconArrowUp/IconArrowDown/IconTrash/TruncatedText 等）必须删掉，避免 lint 报错。
- 检查无 TS 类型错误：`npx tsc --noEmit -p tsconfig.json`（只读，不 build）。
- 上传区 FileDropZone 保持原样不动（label/accept/onFiles 与现在一致，可保留原有 disabled/icon 等）。

## 逐 Tab 说明
- merge：items 加 rotation，doMerge 前 rotatePdfBytes 后 mergePdfs；统计行保留。
- split：单文件 → items=[one]，重新上传替换整个数组；doExtract/doSplitEvery 用旋转后字节。
- compress：items 增 rotation/before/after/done；extra 在渲染时计算（如 "1.2 MB → 800 KB · 瘦 33%"）；
  run() 中 rotatePdfBytes 后 compressPdf；结果回写 setItems 更新 after/done。
- to-image：单文件 items；run() 传 rotation 给 pdfToImages。
- page-num / watermark：单文件 items；run() 先 rotatePdfBytes 再 addPageNumbers / addWatermark。
- security：单文件 items；runEncrypt/runDecrypt 用旋转后字节。
- img2pdf：kind="image"，items = PdfFileItem & { width; height }，保留 loadImage 取尺寸；
  移除自带列表/拖拽/旋转/移除逻辑与 ib-* 类；run() 传 rotation。
- organize：页面级工具，保留页网格（改用 .pfl-page-* 类替代 .ib-*），
  页面缩略图点击打开 PdfViewerModal（bytes=file.bytes, pageCount=file.pages, pageIndex, onPageChange, rotation=0）。
- rotate：页面级工具，保留 vc-* 页网格与逐页旋转/智能检测/批量下载；
  删除内联 viewer 与其 viewZoom/viewLoading/viewCanvasRef/viewWrapRef/prevViewerNullRef/Esc/滚轮逻辑，
  改用 PdfViewerModal（actions 传逐页左旋/右旋/重置/下载按钮；rotation=当前页角度；bytes=row.blob）。

## 自检清单（交付前必须逐项确认）
1. 文件列表显示缩略图（pdf 首页 / 图片），点击缩略图弹出放大模态，可 Ctrl/Cmd+滚轮或按钮缩放、Esc/背景关闭。
2. 旋转按钮递增 90°，角标显示，旋转后缩略图重渲染；业务输出确实应用了角度。
3. 拖拽排序 + 上移/下移生效，顺序传入业务（如合并顺序）。
4. 移除生效；busy 时按钮/拖拽禁用。
5. 移动端（窄屏）网格换行正常、无横向溢出。
6. npx tsc --noEmit 无新增错误。
