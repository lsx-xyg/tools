import { PDFDocument, PageSizes, degrees } from "pdf-lib";
import CryptoJS from "crypto-js";

/** 读取 PDF 页数；加密/损坏时抛出可读错误 */
export async function pdfPages(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return doc.getPageCount();
}

/** 整文件旋转（顺时针 0/90/180/270 度）；0 度原样返回。用于文件列表旋转真实作用到业务输出 */
export async function rotatePdfBytes(bytes: ArrayBuffer, rotation: number): Promise<ArrayBuffer> {
  const rot = (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  if (rot === 0) return bytes;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const pages = doc.getPages();
  for (const p of pages) p.setRotation(degrees(rot));
  const out = await doc.save();
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

/** 合并多个 PDF（按传入顺序） */
export async function mergePdfs(files: ArrayBuffer[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

/**
 * 解析页码范围："1-3,5,7-9"（支持逗号/中文逗号/分号/空格分隔），
 * 超界自动裁剪，返回 0 起下标。空输入或非法返回 []。
 */
export function parseRanges(input: string, total: number): number[] {
  const set = new Set<number>();
  const parts = input.split(/[,，;；\s]+/).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`无法识别「${part}」，请用 1-3,5,7-9 形式`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) throw new Error(`范围无效「${part}」`);
    for (let i = a; i <= b; i += 1) {
      if (i <= total) set.add(i - 1);
    }
  }
  return [...set].sort((x, y) => x - y);
}

/** 提取指定页（0 起下标）为新的 PDF */
export async function extractPages(bytes: ArrayBuffer, indices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const p of pages) out.addPage(p);
  return out.save();
}

/** 每 N 页拆分，返回 { name, data } 列表 */
export async function splitByN(
  bytes: ArrayBuffer,
  n: number,
): Promise<{ name: string; data: Uint8Array }[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const total = src.getPageCount();
  const chunks: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < total; i += n) {
    const out = await PDFDocument.create();
    const idx = Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k);
    const pages = await out.copyPages(src, idx);
    for (const p of pages) out.addPage(p);
    chunks.push({ name: `part-${Math.floor(i / n) + 1}`, data: await out.save() });
  }
  return chunks;
}

/** 触发浏览器下载（Blob） */
export function downloadBytes(data: Uint8Array | Blob, filename: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 友好错误消息（pdf-lib 加密/损坏错误） */
export function pdfError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "未知错误";
  if (/encrypt/i.test(msg) || /password/i.test(msg)) {
    return "该 PDF 已加密（有密码），暂不支持处理";
  }
  if (/parse|corrupt|invalid|EOF/i.test(msg)) {
    return "无法解析该 PDF，文件可能已损坏或不是有效的 PDF";
  }
  return `处理失败：${msg}`;
}

/* ===================== 共享 pdf.js 懒加载 ===================== */

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
/** 共享的 pdf.js 懒加载（worker 用 new URL 模式，Next 打包友好） */
export async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

/* ===================== 压缩 ===================== */

export type CompressLevel = "auto" | "low" | "medium" | "high";

/**
 * 三档栅格化参数：scale = pdf.js 渲染倍率（1.0 ≈ 72dpi），quality = JPEG 质量。
 * 参考 smallpdf 思路：默认不降分辨率，只重编码图片流；显式有损档也从足够高的
 * 分辨率起步，避免"糊"。原配置 low 仅 0.9 倍率（<72dpi），对 300dpi 扫描件会
 * 砍到 1/4 分辨率导致看不清——现提到 1.5 倍率（≈108dpi）起步，肉眼接近无损。
 */
const RASTER_PARAMS: Record<Exclude<CompressLevel, "auto">, { scale: number; quality: number }> = {
  low: { scale: 1.5, quality: 0.85 },
  medium: { scale: 1.2, quality: 0.75 },
  high: { scale: 1.0, quality: 0.6 },
};

/** auto 档：无损重写收益达到该比例(15%)直接用无损；否则尝试高保真重编码（视觉无损级） */
const AUTO_LOSSLESS_GAIN = 0.15;
/** auto 档高保真重编码参数：2.0 倍率（≈144dpi）+ 0.85 质量，肉眼接近无损，体积显著下降 */
const AUTO_REENCODE = { scale: 2.0, quality: 0.85 } as const;

/** 路径 A：无损重写（useObjectStreams 剔除冗余对象）。对文本型 PDF 安全、体积通常略降 */
async function losslessRewrite(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return doc.save({ useObjectStreams: true });
}

/**
 * 路径 B：栅格化重建。逐页 pdf.js 渲染为 JPEG，再用 pdf-lib 整页铺满重打包（白底）。
 * 注意：入口已先 rotatePdfBytes 旋转，故这里 rotation 恒传 0；页面尺寸取 1:1 视口宽高(pt)。
 * 栅格化后文字不可选中，仅适合扫描件/图片类 PDF。
 */
async function rasterizeRebuild(
  bytes: ArrayBuffer,
  scale: number,
  quality: number,
): Promise<Uint8Array> {
  const pdfjs = await getPdfjs();
  const src = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i += 1) {
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1, rotation: 0 });
      const viewport = page.getViewport({ scale, rotation: 0 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpg = await canvasToBytes(canvas, "image/jpeg", quality);
      const img = await out.embedJpg(jpg);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
  } finally {
    await src.destroy();
  }
  return out.save({ useObjectStreams: true });
}

/**
 * 分级真实压缩（对齐 smallpdf 思路：默认不降分辨率、只重编码图片流）：
 * - auto（建议）：先无损重写；若收益 < 15%（说明图片型 / 已优化 PDF），再尝试
 *   高保真重编码（2.0 倍率渲染 + 0.85 JPEG，≈144dpi 肉眼接近无损），两者取更小者。
 *   文本型 PDF 走无损不膨胀，图片型 PDF 拿真实压缩且不糊。
 * - low / medium / high：显式栅格化重建，从 1.5 / 1.2 / 1.0 倍率起步，清晰度有保障。
 * 加密/损坏 PDF 在 pdf-lib.load 阶段抛错，由调用方经 pdfError 转可读提示。
 */
export async function compressPdf(
  bytes: ArrayBuffer,
  opts: { level?: CompressLevel } = {},
): Promise<{ data: Uint8Array; before: number; after: number }> {
  const before = bytes.byteLength;
  const level = opts.level ?? "auto";

  if (level === "low" || level === "medium" || level === "high") {
    const p = RASTER_PARAMS[level];
    const data = await rasterizeRebuild(bytes, p.scale, p.quality);
    return { data, before, after: data.length };
  }

  // auto：无损优先，收益不足时高保真重编码取更小者（不糊、不膨胀）
  const rewrite = await losslessRewrite(bytes);
  const gain = 1 - rewrite.length / before;
  if (gain >= AUTO_LOSSLESS_GAIN) {
    return { data: rewrite, before, after: rewrite.length };
  }
  try {
    const rebuilt = await rasterizeRebuild(bytes, AUTO_REENCODE.scale, AUTO_REENCODE.quality);
    const data = rebuilt.length < rewrite.length ? rebuilt : rewrite;
    return { data, before, after: data.length };
  } catch {
    // 栅格化（渲染/编码）失败时退回无损重写，保证至少有产物
    return { data: rewrite, before, after: rewrite.length };
  }
}

/* ===================== PDF 转图片 ===================== */

/** 把 PDF 每页渲染成图片（PNG/JPEG），返回 { name, blob } 列表；rotation 为整文件旋转角（0/90/180/270） */
export async function pdfToImages(
  bytes: ArrayBuffer,
  opts: { scale: number; format: "png" | "jpeg"; quality: number; rotation?: number },
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const out: { name: string; blob: Blob }[] = [];
  const ext = opts.format === "png" ? "png" : "jpg";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: opts.scale, rotation: opts.rotation ?? 0 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
        opts.format === "png" ? "image/png" : "image/jpeg",
        opts.quality,
      );
    });
    out.push({ name: `page-${String(i).padStart(3, "0")}.${ext}`, blob });
  }
  await doc.destroy();
  return out;
}

/* ===================== 图片转 PDF ===================== */

export interface ImgSource {
  blob: Blob;
  width: number;
  height: number;
  /** 顺时针旋转 0/90/180/270（度），默认 0 */
  rotation?: 0 | 90 | 180 | 270;
}

/**
 * 多图按顺序合并为一个 PDF；白底 contain 绘制（不拉伸变形），统一经 canvas 转 JPEG 嵌入。
 * - A4 模式：严格使用 pdf-lib 的 PageSizes.A4，每页尺寸恒为 595.28×841.89（纵向）/841.89×595.28（横向）；
 *   图片在所选纸张内 contain 居中、白底留白，不随图片尺寸改变页面。
 * - auto 模式：页面尺寸跟随图片（旋转 90/270 时交换宽高）。
 */
export async function imagesToPdf(
  files: ImgSource[],
  opts: { pageSize: "a4" | "auto"; orientation: "portrait" | "landscape" },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // 渲染分辨率：约 144 DPI（2×），保证文字/线条清晰；按页面宽高比精确取整，避免拉伸
  const RENDER = 2;
  for (const f of files) {
    const rot = ((f.rotation ?? 0) + 360) % 360;
    const swapped = rot === 90 || rot === 270;
    // 页面尺寸（pt）
    let pageW: number;
    let pageH: number;
    if (opts.pageSize === "auto") {
      pageW = (swapped ? f.height : f.width) * (72 / 96);
      pageH = (swapped ? f.width : f.height) * (72 / 96);
      const maxSide = Math.max(pageW, pageH);
      if (maxSide > 14400) {
        const s = 14400 / maxSide;
        pageW *= s;
        pageH *= s;
      }
    } else if (opts.orientation === "landscape") {
      pageW = PageSizes.A4[1];
      pageH = PageSizes.A4[0];
    } else {
      pageW = PageSizes.A4[0];
      pageH = PageSizes.A4[1];
    }
    // 画布按页面宽高比取整（以宽为基准），保证与页面同比例，整页贴图不拉伸
    const pxW = Math.max(1, Math.round(pageW * RENDER));
    const pxH = Math.max(1, Math.round((pxW * pageH) / pageW));
    const canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pxW, pxH);
    const bmp = await createImageBitmap(f.blob);
    const margin = opts.pageSize === "auto" ? 0 : Math.round(pxW * 0.04);
    // 旋转后的外接宽高用于 contain 计算
    const fitW = swapped ? f.height : f.width;
    const fitH = swapped ? f.width : f.height;
    const s = Math.min((pxW - margin * 2) / fitW, (pxH - margin * 2) / fitH);
    const dw = f.width * s;
    const dh = f.height * s;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.translate(pxW / 2, pxH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    bmp.close();
    const jpg = await canvasToBytes(canvas, "image/jpeg", 0.92);
    const img = await doc.embedJpg(jpg);
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  }
  return doc.save();
}

/* ===================== 删页 / 组织 ===================== */

/** 按保留的页顺序（0 起下标）输出新 PDF */
export async function organizePdf(bytes: ArrayBuffer, keptIndices: number[]): Promise<Uint8Array> {
  return extractPages(bytes, keptIndices);
}

/* ===================== 页码 ===================== */

export interface PageNumOpts {
  position: "bottom-center" | "bottom-left" | "bottom-right";
  format: "full" | "slash" | "number";
  startAt: number;
  fontSize: number;
  margin: number;
}

function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => {
        if (!b) return reject(new Error("图片编码失败"));
        resolve(new Uint8Array(await b.arrayBuffer()));
      },
      type,
      quality,
    );
  });
}

/** 给每页加页码（文字经 canvas 渲染为 PNG，支持中文） */
export async function addPageNumbers(bytes: ArrayBuffer, opts: PageNumOpts): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const total = doc.getPageCount();
  const dpr = 3;
  for (let i = 0; i < total; i += 1) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const num = i + Math.max(1, Math.floor(opts.startAt || 1));
    const label =
      opts.format === "full"
        ? `第 ${num} 页 / 共 ${total} 页`
        : opts.format === "slash"
          ? `${num} / ${total}`
          : `${num}`;
    const fontPx = opts.fontSize;
    const canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")!;
    ctx.font = `${fontPx * dpr}px system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    canvas.width = Math.ceil(tw) + 12;
    canvas.height = Math.ceil(fontPx * dpr * 1.5);
    ctx = canvas.getContext("2d")!;
    ctx.font = `${fontPx * dpr}px system-ui, sans-serif`;
    ctx.fillStyle = "#333333";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 6, canvas.height / 2);
    const png = await canvasToBytes(canvas, "image/png");
    const img = await doc.embedPng(png);
    const drawW = canvas.width / dpr;
    const drawH = canvas.height / dpr;
    const y = opts.margin;
    let x: number;
    if (opts.position === "bottom-center") x = (width - drawW) / 2;
    else if (opts.position === "bottom-left") x = opts.margin;
    else x = width - opts.margin - drawW;
    page.drawImage(img, { x, y, width: drawW, height: drawH });
  }
  return doc.save();
}

/* ===================== 文字水印 ===================== */

export interface WatermarkOpts {
  text: string;
  fontSize: number;
  opacity: number; // 0.1 ~ 0.5
  angle: number;
  color: string; // css color
  tiled: boolean;
}

/** 给每页加文字水印（canvas 平铺/居中 → PNG 整页叠加，透明度由 canvas 控制） */
export async function addWatermark(bytes: ArrayBuffer, opts: WatermarkOpts): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const pages = doc.getPages();
  const dpr = 2;
  for (const page of pages) {
    const { width, height } = page.getSize();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = opts.opacity;
    ctx.fillStyle = opts.color;
    ctx.font = `${opts.fontSize * dpr}px system-ui, sans-serif`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((opts.angle * Math.PI) / 180);
    if (opts.tiled) {
      const stepX = ctx.measureText(opts.text).width + 120 * dpr;
      const stepY = (opts.fontSize + 60) * dpr;
      for (let y = -canvas.height; y < canvas.height; y += stepY) {
        for (let x = -canvas.width; x < canvas.width; x += stepX) {
          ctx.fillText(opts.text, x, y);
        }
      }
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.text, 0, 0);
    }
    const png = await canvasToBytes(canvas, "image/png");
    const img = await doc.embedPng(png);
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
  return doc.save();
}

/* ===================== 加密 / 解密（RC4 Standard security handler） ===================== */

/* pdf-lib 1.17 不支持加密，这里以后处理方式注入 PDF Standard 安全处理器（V1/R2 RC4 40-bit）。
   AES 加密（V>=4）的 PDF 无法在浏览器内解密，会给出明确提示。 */

const PDF_PAD = [
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
];

class Rc4 {
  private s: number[];
  private i = 0;
  private j = 0;
  constructor(key: number[]) {
    this.s = Array.from({ length: 256 }, (_, k) => k);
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
      j = (j + this.s[i] + key[i % key.length]) & 0xff;
      [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
    }
  }
  process(data: number[]): number[] {
    const out: number[] = [];
    for (const b of data) {
      this.i = (this.i + 1) & 0xff;
      this.j = (this.j + this.s[this.i]) & 0xff;
      [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
      out.push(b ^ this.s[(this.s[this.i] + this.s[this.j]) & 0xff]);
    }
    return out;
  }
}

function md5Bytes(data: number[]): number[] {
  const s = String.fromCharCode(...data);
  const words = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(s)).words;
  const out: number[] = [];
  for (const w of words) {
    out.push((w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff);
  }
  return out;
}

function padPassword(pw: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    bytes.push(i < pw.length ? pw.charCodeAt(i) & 0xff : PDF_PAD[i]);
  }
  return bytes;
}

const toBytes = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));
const toLatin1 = (b: number[]): string => b.map((x) => String.fromCharCode(x)).join("");
const toHex = (b: number[]): string => b.map((x) => x.toString(16).padStart(2, "0")).join("");

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function int32LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function objKeyOf(base: number[], num: number, gen: number, keylen: number): number[] {
  return md5Bytes([...base, num & 0xff, (num >> 8) & 0xff, gen & 0xff, (gen >> 8) & 0xff]).slice(0, keylen);
}

/**
 * 统一处理一个对象体内的字符串：
 * - `<<` `>>` 是字典括号，原样保留，绝不参与加解密；
 * - `<hex>` 与 `(literal)` 都是字符串，按对象密钥做 RC4，密文统一写成 hex `<...>`。
 * 加密与解密共用此函数（RC4 对称）：加密时字面串/已有 hex 串都会被加密；
 * 解密时所有 hex 串被还原，字典键 `/Name` 始终不受影响。
 */
function walkStrings(rc4: Rc4, body: string): string {
  let out = "";
  let i = 0;
  const n = body.length;
  while (i < n) {
    const ch = body[i];
    /* 字典开始 << */
    if (ch === "<" && body[i + 1] === "<") {
      out += "<<";
      i += 2;
      continue;
    }
    /* 字典结束 >> */
    if (ch === ">" && body[i + 1] === ">") {
      out += ">>";
      i += 2;
      continue;
    }
    /* hex 字符串 <...> */
    if (ch === "<") {
      let j = i + 1;
      while (j < n && body[j] !== ">") j += 1;
      const hex = body.slice(i + 1, j).replace(/\s/g, "");
      const dec = rc4.process(hexToBytes(hex));
      out += `<${toHex(dec)}>`;
      i = j + 1;
      continue;
    }
    /* 字面字符串 (...) */
    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      let content = "";
      while (j < n && depth > 0) {
        const c = body[j];
        if (c === "\\") {
          content += c + body[j + 1];
          j += 2;
          continue;
        }
        if (c === "(") depth += 1;
        else if (c === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        content += c;
        j += 1;
      }
      out += `<${toHex(rc4.process(toBytes(content)))}>`;
      i = j + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** 加密对象体：先抽出 stream 占位（避免把二进制当字符串），处理字典字符串，再按序加密 stream */
function encryptBody(rc4: Rc4, body: string): string {
  const streams: string[] = [];
  let text = body.replace(/stream\r?\n([\s\S]*?)\r?\nendstream/g, (_m, content: string) => {
    streams.push(content);
    return `stream@@${streams.length - 1}@@endstream`;
  });
  text = walkStrings(rc4, text);
  return text.replace(/stream@@(\d+)@@endstream/g, (_m, idx: string) => {
    const enc = rc4.process(toBytes(streams[Number(idx)]));
    return `stream\n${toLatin1(enc)}\nendstream`;
  });
}

/** 解密对象体：与加密对称，stream 占位 + walkStrings 还原字符串 */
function decryptBody(rc4: Rc4, body: string): string {
  const streams: string[] = [];
  let text = body.replace(/stream\r?\n([\s\S]*?)\r?\nendstream/g, (_m, content: string) => {
    streams.push(content);
    return `stream@@${streams.length - 1}@@endstream`;
  });
  text = walkStrings(rc4, text);
  return text.replace(/stream@@(\d+)@@endstream/g, (_m, idx: string) => {
    const dec = rc4.process(toBytes(streams[Number(idx)]));
    return `stream\n${toLatin1(dec)}\nendstream`;
  });
}

/** 加密 PDF：用户密码必填，可选所有者密码与打印/复制权限 */
export async function encryptPdf(
  bytes: ArrayBuffer,
  opts: { userPassword: string; ownerPassword?: string; printing: boolean; copying: boolean },
): Promise<Uint8Array> {
  if (!opts.userPassword) throw new Error("请设置用户密码");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const norm = await doc.save({ useObjectStreams: false });
  let s = toLatin1(Array.from(norm));

  const userPw = opts.userPassword;
  const ownerPw = opts.ownerPassword && opts.ownerPassword.length ? opts.ownerPassword : userPw;
  const keylen = 5; // 40-bit

  const fileId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  // O（Algorithm 3）
  const oKey = md5Bytes(padPassword(ownerPw)).slice(0, keylen);
  const O = new Rc4(oKey).process(padPassword(userPw));

  let P = -44;
  if (!opts.printing) P -= 4;
  if (!opts.copying) P -= 16;

  // 加密 key（Algorithm 2）
  let key = md5Bytes([...padPassword(userPw), ...O, ...int32LE(P), ...fileId]).slice(0, keylen);

  // U（Algorithm 4, R2）
  const U = new Rc4(key).process(md5Bytes([...padPassword(""), ...fileId]));

  // 解析 trailer
  const trailerMatch = s.match(/trailer\s*<<([\s\S]*?)>>\s*startxref/);
  let rootRef = "2 0 R";
  let infoRef: string | null = null;
  if (trailerMatch) {
    const rm = trailerMatch[1].match(/\/Root\s+(\d+\s+\d+\s+R)/);
    if (rm) rootRef = rm[1];
    const im = trailerMatch[1].match(/\/Info\s+(\d+\s+\d+\s+R)/);
    if (im) infoRef = im[1];
  }

  const objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  const objs: { num: number; gen: number; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(s))) objs.push({ num: Number(m[1]), gen: Number(m[2]), body: m[3] });

  const encObjs = objs.map((o) => ({
    num: o.num,
    gen: o.gen,
    body: encryptBody(new Rc4(objKeyOf(key, o.num, o.gen, keylen)), o.body),
  }));

  const encObjNum = Math.max(...objs.map((o) => o.num)) + 1;
  const encDict = `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${toHex(O)}> /U <${toHex(U)}> /P ${P} >>`;

  let out = "%PDF-1.7\n";
  const offsets: { num: number; offset: number }[] = [];
  for (const o of encObjs) {
    offsets.push({ num: o.num, offset: out.length });
    out += `${o.num} ${o.gen} obj${o.body}endobj\n`;
  }
  offsets.push({ num: encObjNum, offset: out.length });
  out += `${encObjNum} 0 obj\n${encDict}\nendobj\n`;
  const xrefPos = out.length;
  const size = encObjNum + 1;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i += 1) {
    const o = offsets.find((x) => x.num === i);
    out += o ? `${String(o.offset).padStart(10, "0")} 00000 n \n` : `0000000000 00000 f \n`;
  }
  out += `trailer\n<< /Size ${size} /Root ${rootRef}${infoRef ? ` /Info ${infoRef}` : ""} /Encrypt ${encObjNum} 0 R /ID [<${toHex(fileId)}> <${toHex(fileId)}>] >>\n`;
  out += `startxref\n${xrefPos}\n%%EOF\n`;
  return Uint8Array.from(toBytes(out));
}

/** 解密 PDF：返回 { bytes, wasEncrypted }。未加密直接返回；AES 抛错。 */
export async function decryptPdf(
  bytes: ArrayBuffer,
  password: string,
): Promise<{ bytes: Uint8Array; wasEncrypted: boolean }> {
  const s = toLatin1(Array.from(new Uint8Array(bytes)));

  /* 先扫原始字节有无 /Encrypt；没有（含 object-stream 产物）直接视为未加密 */
  if (!/\/Encrypt\s+\d+\s+\d+\s+R/.test(s)) {
    return { bytes: new Uint8Array(bytes), wasEncrypted: false };
  }

  const trailerMatch = s.match(/trailer\s*<<([\s\S]*?)>>\s*startxref/);
  const trailerBody = trailerMatch ? trailerMatch[1] : s;

  const encRefMatch = trailerBody.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
  if (!encRefMatch) return { bytes: new Uint8Array(bytes), wasEncrypted: false };
  const encNum = Number(encRefMatch[1]);

  const objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  const objs: { num: number; gen: number; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(s))) objs.push({ num: Number(m[1]), gen: Number(m[2]), body: m[3] });

  const encObj = objs.find((o) => o.num === encNum);
  if (!encObj) throw new Error("加密字典缺失");

  const V = Number((encObj.body.match(/\/V\s+(\d+)/) || [])[1] || 0);
  if (V >= 4) {
    throw new Error("该 PDF 使用 AES 加密（V≥4），浏览器内暂不支持解密，请先在专业工具解除密码");
  }
  const keylen = Number((encObj.body.match(/\/Length\s+(\d+)/) || [])[1] || 40) / 8;
  const O = hexToBytes((encObj.body.match(/\/O\s+<([0-9A-Fa-f]+)>/) || [])[1] || "");
  const U = hexToBytes((encObj.body.match(/\/U\s+<([0-9A-Fa-f]+)>/) || [])[1] || "");
  const P = Number((encObj.body.match(/\/P\s+(-?\d+)/) || [])[1] || -44);
  const fileId = hexToBytes((trailerBody.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>/) || [])[1] || "");

  const key = md5Bytes([...padPassword(password), ...O, ...int32LE(P), ...fileId]).slice(0, keylen);
  const computedU = new Rc4(key).process(md5Bytes([...padPassword(""), ...fileId]));
  const cmpLen = Math.min(computedU.length, U.length);
  for (let i = 0; i < cmpLen; i += 1) {
    if (computedU[i] !== U[i]) throw new Error("密码错误");
  }

  const rootM = trailerBody.match(/\/Root\s+(\d+\s+\d+\s+R)/);
  const rootRef = rootM ? rootM[1] : "2 0 R";
  const infoM = trailerBody.match(/\/Info\s+(\d+\s+\d+\s+R)/);
  const infoRef = infoM ? infoM[1] : null;

  const decObjs = objs
    .filter((o) => o.num !== encNum)
    .map((o) => ({
      num: o.num,
      gen: o.gen,
      body: decryptBody(new Rc4(objKeyOf(key, o.num, o.gen, keylen)), o.body),
    }));

  let out = "%PDF-1.7\n";
  const offsets: { num: number; offset: number }[] = [];
  for (const o of decObjs) {
    offsets.push({ num: o.num, offset: out.length });
    out += `${o.num} ${o.gen} obj${o.body}endobj\n`;
  }
  const xrefPos = out.length;
  const size = Math.max(...decObjs.map((o) => o.num)) + 1;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i += 1) {
    const o = offsets.find((x) => x.num === i);
    out += o ? `${String(o.offset).padStart(10, "0")} 00000 n \n` : `0000000000 00000 f \n`;
  }
  out += `trailer\n<< /Size ${size} /Root ${rootRef}${infoRef ? ` /Info ${infoRef}` : ""} /ID [<${toHex(fileId)}> <${toHex(fileId)}>] >>\n`;
  out += `startxref\n${xrefPos}\n%%EOF\n`;
  return { bytes: Uint8Array.from(toBytes(out)), wasEncrypted: true };
}
