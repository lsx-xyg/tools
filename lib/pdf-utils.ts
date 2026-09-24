import { PDFDocument } from "pdf-lib";

/** 读取 PDF 页数；加密/损坏时抛出可读错误 */
export async function pdfPages(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return doc.getPageCount();
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
