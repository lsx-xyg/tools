/** 打印工具（T-41）共享类型 */
export interface FileItem {
  id: string;
  file: File;
  kind: "pdf" | "image" | "word" | "text";
  /** 图片/PDF 的缩略图 dataURL（懒生成）；Word/文本无缩略图 */
  thumb?: string;
  meta: string;
}

export function kindOf(file: File): FileItem["kind"] {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx") || n.endsWith(".doc")) return "word";
  if (file.type.startsWith("image/")) return "image";
  return "text";
}
