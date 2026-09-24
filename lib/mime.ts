/**
 * MIME ↔ 文件扩展名映射表（常用类型，双向查询）。
 * 纯本地，无请求。
 */

interface MimeEntry {
  mime: string;
  exts: string[];
}

const TABLE: MimeEntry[] = [
  // ---- 文本 ----
  { mime: "text/plain", exts: ["txt"] },
  { mime: "text/html", exts: ["html", "htm"] },
  { mime: "text/css", exts: ["css"] },
  { mime: "text/javascript", exts: ["js", "mjs"] },
  { mime: "text/xml", exts: ["xml"] },
  { mime: "text/csv", exts: ["csv"] },
  { mime: "text/markdown", exts: ["md", "markdown"] },
  { mime: "text/x-yaml", exts: ["yaml", "yml"] },
  { mime: "text/x-ini", exts: ["ini"] },
  { mime: "application/json", exts: ["json"] },
  { mime: "application/x-httpd-php", exts: ["php"] },
  { mime: "application/x-sh", exts: ["sh", "bash"] },
  { mime: "application/sql", exts: ["sql"] },
  // ---- 图片 ----
  { mime: "image/png", exts: ["png"] },
  { mime: "image/jpeg", exts: ["jpg", "jpeg", "jpe"] },
  { mime: "image/gif", exts: ["gif"] },
  { mime: "image/webp", exts: ["webp"] },
  { mime: "image/svg+xml", exts: ["svg", "svgz"] },
  { mime: "image/avif", exts: ["avif"] },
  { mime: "image/bmp", exts: ["bmp"] },
  { mime: "image/x-icon", exts: ["ico"] },
  { mime: "image/tiff", exts: ["tif", "tiff"] },
  { mime: "image/heic", exts: ["heic"] },
  { mime: "image/heif", exts: ["heif"] },
  // ---- 音频 ----
  { mime: "audio/mpeg", exts: ["mp3"] },
  { mime: "audio/wav", exts: ["wav"] },
  { mime: "audio/ogg", exts: ["ogg", "oga"] },
  { mime: "audio/mp4", exts: ["m4a", "mp4a"] },
  { mime: "audio/aac", exts: ["aac"] },
  { mime: "audio/flac", exts: ["flac"] },
  { mime: "audio/webm", exts: ["weba"] },
  { mime: "audio/midi", exts: ["mid", "midi"] },
  { mime: "audio/x-m4a", exts: ["m4a"] },
  // ---- 视频 ----
  { mime: "video/mp4", exts: ["mp4", "m4v"] },
  { mime: "video/webm", exts: ["webm"] },
  { mime: "video/ogg", exts: ["ogv"] },
  { mime: "video/quicktime", exts: ["mov", "qt"] },
  { mime: "video/x-msvideo", exts: ["avi"] },
  { mime: "video/x-matroska", exts: ["mkv"] },
  { mime: "video/mpeg", exts: ["mpeg", "mpg"] },
  { mime: "video/3gpp", exts: ["3gp"] },
  // ---- 应用 / 文档 ----
  { mime: "application/pdf", exts: ["pdf"] },
  { mime: "application/rtf", exts: ["rtf"] },
  { mime: "application/zip", exts: ["zip"] },
  { mime: "application/gzip", exts: ["gz"] },
  { mime: "application/x-tar", exts: ["tar"] },
  { mime: "application/x-7z-compressed", exts: ["7z"] },
  { mime: "application/x-rar-compressed", exts: ["rar"] },
  { mime: "application/x-bzip2", exts: ["bz2"] },
  { mime: "application/x-xz", exts: ["xz"] },
  { mime: "application/vnd.ms-excel", exts: ["xls"] },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", exts: ["xlsx"] },
  { mime: "application/msword", exts: ["doc"] },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", exts: ["docx"] },
  { mime: "application/vnd.ms-powerpoint", exts: ["ppt"] },
  { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", exts: ["pptx"] },
  { mime: "application/vnd.oasis.opendocument.text", exts: ["odt"] },
  { mime: "application/vnd.oasis.opendocument.spreadsheet", exts: ["ods"] },
  { mime: "application/x-msdownload", exts: ["exe", "dll"] },
  { mime: "application/java-archive", exts: ["jar"] },
  { mime: "application/wasm", exts: ["wasm"] },
  { mime: "application/x-iso9660-image", exts: ["iso"] },
  { mime: "application/vnd.apple.installer+xml", exts: ["mpkg"] },
  { mime: "application/x-msaccess", exts: ["mdb"] },
  { mime: "application/epub+zip", exts: ["epub"] },
  { mime: "application/octet-stream", exts: ["bin"] },
  { mime: "application/x-executable", exts: ["run"] },
  // ---- 字体 ----
  { mime: "font/ttf", exts: ["ttf"] },
  { mime: "font/otf", exts: ["otf"] },
  { mime: "font/woff", exts: ["woff"] },
  { mime: "font/woff2", exts: ["woff2"] },
];

export const MIME_TABLE: ReadonlyArray<{ mime: string; exts: string[] }> = TABLE;

export function lookupMime(input: string): { mime: string; exts: string[] }[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const isMime = q.includes("/");
  if (isMime) {
    return TABLE.filter((e) => e.mime === q).map((e) => ({ mime: e.mime, exts: [...e.exts] }));
  }
  const ext = q.replace(/^\./, "");
  return TABLE.filter((e) => e.exts.includes(ext)).map((e) => ({ mime: e.mime, exts: [...e.exts] }));
}

export function searchTable(q: string): { mime: string; exts: string[] }[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return TABLE.filter(
    (e) => e.mime.includes(s) || e.exts.some((x) => x.includes(s.replace(/^\./, ""))),
  );
}
