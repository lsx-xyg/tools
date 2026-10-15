"use client";

/**
 * 全站统一「上传文件列表」组件（PDF 工具箱专用）。
 *
 * 支持两种文件类型（kind）：
 * - pdf  ：pdfjs-dist 渲染首页缩略图；点击放大模态支持 Ctrl/Cmd+滚轮 / 按钮缩放、多页翻页
 * - image：<img> 缩略图，CSS 旋转；放大模态同样可缩放
 *
 * 统一能力：首屏缩略图预览 / 点击放大预览（模态缩放）/ 逐文件旋转（rotation 记录在 item 上，
 * 由各 Tab 在业务输出时读取，如通过 lib/pdf-utils 的 rotatePdfBytes 应用到合并/压缩/加密等）/
 * 拖拽排序 + 上移下移 / 移除。受控组件：items 由父级持有，任何内部变更通过 onChange 回传。
 *
 * 同时导出 PdfViewerModal，供页面级工具（rotate / organize 等）复用同一放大预览模态。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconFile,
  IconLoader,
  IconRotateCw,
  IconTrash,
  IconX,
} from "@/components/icons";
import { getPdfjs } from "@/lib/pdf-utils";

export type PdfFileKind = "pdf" | "image" | "doc";

export interface PdfFileItem {
  /** 稳定 id（字符串），Tab 侧生成即可 */
  id: string;
  kind: PdfFileKind;
  name: string;
  file: File | Blob;
  /** pdf 类型预读字节（可选；缺省时组件从 file 读取） */
  bytes?: ArrayBuffer;
  /** pdf 页数（可选，用于元信息与放大模态翻页） */
  pages?: number;
  /** 顺时针旋转角度 0/90/180/270 */
  rotation: number;
  /** 附加元信息（如压缩前后体积、图片尺寸），显示在名称下方 */
  extra?: string;
}

export interface PdfFileListProps {
  items: PdfFileItem[];
  onChange: (next: PdfFileItem[]) => void;
  disabled?: boolean;
  className?: string;
}

const nextRot = (r: number) => ((((r + 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;

const VIEW_BASE = 1.5;
const VIEW_MIN = 0.5;
const VIEW_MAX = 4;

/* ===================== 放大预览模态（共享） ===================== */

export interface PdfViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: PdfFileKind;
  /** pdf 源：bytes 或 blob 二选一 */
  bytes?: ArrayBuffer;
  blob?: Blob;
  /** image 源（objectURL） */
  imageUrl?: string;
  imageRotation?: number;
  pageCount?: number;
  pageIndex?: number;
  onPageChange?: (i: number) => void;
  /** pdf 当前页渲染旋转角（页面级工具逐页传入） */
  rotation?: number;
  /** 头部附加按钮（如逐页旋转/下载） */
  actions?: ReactNode;
  disabled?: boolean;
}

export function PdfViewerModal({
  open,
  onClose,
  title,
  kind,
  bytes,
  blob,
  imageUrl,
  imageRotation,
  pageCount,
  pageIndex,
  onPageChange,
  rotation,
  actions,
  disabled = false,
}: PdfViewerModalProps) {
  const [zoom, setZoom] = useState(VIEW_BASE);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);
  const prevOpenRef = useRef(false);
  /* 图片预览：记录自然尺寸与可视区域，使旋转后外接盒随方向适配（避免旋转后溢出/被裁） */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgNat, setImgNat] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);

  /* 切换图片源时重置自然尺寸 */
  useEffect(() => {
    setImgNat(null);
  }, [imageUrl]);

  /* 测量可视区域尺寸 */
  useEffect(() => {
    if (!open || kind !== "image") return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, kind, imageUrl]);

  /* 打开时重置缩放（翻页/旋转不重置） */
  useEffect(() => {
    if (open && !prevOpenRef.current) setZoom(VIEW_BASE);
    prevOpenRef.current = open;
  }, [open]);

  /* 加载 pdf 文档（同一 open 内缓存，关闭销毁） */
  useEffect(() => {
    if (!open || kind !== "pdf") return;
    let cancelled = false;
    (async () => {
      try {
        const src = blob ?? bytes;
        if (!src) return;
        const pdfjs = await getPdfjs();
        const data = src instanceof Blob ? await src.arrayBuffer() : src.slice(0);
        const d = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) {
          setDoc((prev) => {
            if (prev) void prev.destroy();
            return d;
          });
        }
      } catch {
        /* 渲染失败保持静默 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, bytes, blob]);

  /* 关闭时销毁文档 */
  useEffect(() => {
    if (!open) {
      setDoc((prev) => {
        if (prev) void prev.destroy();
        return null;
      });
      setLoading(false);
    }
  }, [open]);

  /* 渲染当前页（缩放/翻页/旋转变化时重渲染） */
  useEffect(() => {
    if (!open || kind !== "pdf" || !doc) return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        taskRef.current?.cancel();
        const page = await doc.getPage((pageIndex ?? 0) + 1);
        const viewport = page.getViewport({ scale: zoom, rotation: rotation ?? 0 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setLoading(true);
        const task = page.render({ canvasContext: ctx, viewport });
        taskRef.current = task;
        await task.promise;
        page.cleanup();
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (e instanceof Error && /cancel/i.test(e.message)) return;
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, doc, pageIndex, rotation, zoom]);

  /* Ctrl/Cmd + 滚轮缩放（挂 document，覆盖模态任意位置） */
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => {
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        return Math.min(VIEW_MAX, Math.max(VIEW_MIN, +(z + delta).toFixed(1)));
      });
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [open]);

  /* Esc 关闭 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pi = Math.max(0, pageIndex ?? 0);
  const count = Math.max(1, pageCount ?? 1);
  const hasPrev = pi > 0;
  const hasNext = pi < count - 1;
  const rot = kind === "pdf" ? (rotation ?? 0) : (imageRotation ?? 0);

  return (
    <div className="vc-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="vc-viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="vc-viewer-head">
          <div className="vc-viewer-title">
            <IconFile width={16} height={16} />
            <span className="vc-viewer-name" title={title}>
              {title}
            </span>
            {kind === "pdf" && count > 1 && (
              <span className="vc-viewer-meta">
                {pi + 1} / {count} 页
              </span>
            )}
            {rot !== 0 && <span className="vc-rotation-badge-static">{rot}°</span>}
          </div>
          <div className="vc-viewer-actions">
            {actions}
            <div className="vc-viewer-zoom">
              <button
                className="vc-ctrl-btn vc-ctrl-sm"
                onClick={() => setZoom((z) => Math.max(VIEW_MIN, +(z - 0.2).toFixed(1)))}
                disabled={disabled}
                title="缩小（Ctrl + 滚轮）"
                type="button"
              >
                −
              </button>
              <button
                className="vc-ctrl-btn vc-ctrl-sm vc-viewer-zoom-val"
                onClick={() => setZoom(VIEW_BASE)}
                title="点击重置为 100%"
                type="button"
              >
                {Math.round((zoom / VIEW_BASE) * 100)}%
              </button>
              <button
                className="vc-ctrl-btn vc-ctrl-sm"
                onClick={() => setZoom((z) => Math.min(VIEW_MAX, +(z + 0.2).toFixed(1)))}
                disabled={disabled}
                title="放大（Ctrl + 滚轮）"
                type="button"
              >
                +
              </button>
            </div>
            <button
              className="vc-ctrl-btn vc-ctrl-sm vc-viewer-close"
              onClick={onClose}
              title="关闭（Esc）"
              type="button"
            >
              <IconX width={14} height={14} />
              关闭
            </button>
          </div>
        </div>
        <div className="vc-viewer-body">
          {hasPrev && (
            <button
              className="vc-viewer-nav"
              onClick={() => onPageChange?.(pi - 1)}
              title="上一页"
              type="button"
            >
              ‹
            </button>
          )}
          <div className="vc-viewer-canvas-wrap" ref={wrapRef}>
            {kind === "pdf" ? (
              <canvas ref={canvasRef} className="vc-viewer-canvas" />
            ) : kind === "doc" ? (
              <div className="pfl-thumb-ph doc" style={{ minHeight: 160 }}>
                <IconFile width={40} height={40} />
                <span className="pfl-sub">Word 文档 · 合成时转为扫描件页</span>
              </div>
            ) : (
              imageUrl &&
              (() => {
                const rot = imageRotation ?? 0;
                const swapped = rot === 90 || rot === 270;
                let wrapStyle: CSSProperties | undefined;
                const imgStyle: CSSProperties = { transition: "transform .15s ease" };
                if (imgNat && view) {
                  // wrapper = 旋转后外接盒（含缩放），img = 旋转前盒子，transform 仅做旋转
                  const dispW = swapped ? imgNat.h : imgNat.w;
                  const dispH = swapped ? imgNat.w : imgNat.h;
                  const base = Math.min(view.w / dispW, view.h / dispH);
                  const W = dispW * base * zoom;
                  const H = dispH * base * zoom;
                  wrapStyle = { width: W, height: H };
                  Object.assign(imgStyle, {
                    width: swapped ? H : W,
                    height: swapped ? W : H,
                    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                    maxWidth: "none",
                    maxHeight: "none",
                  });
                }
                return (
                  <div className="vc-viewer-img-wrap" style={wrapStyle}>
                    <img
                      src={imageUrl}
                      alt={title}
                      className="vc-viewer-canvas"
                      onLoad={(e) =>
                        setImgNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                      }
                      style={imgStyle}
                    />
                  </div>
                );
              })()
            )}
            {loading && (
              <div className="vc-viewer-loading">
                <IconLoader width={28} height={28} className="spin" />
              </div>
            )}
          </div>
          {hasNext && (
            <button
              className="vc-viewer-nav"
              onClick={() => onPageChange?.(pi + 1)}
              title="下一页"
              type="button"
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== 缩略图 ===================== */

function Thumb({
  item,
  url,
  getDoc,
}: {
  item: PdfFileItem;
  url: string | null;
  getDoc: (it: PdfFileItem) => Promise<import("pdfjs-dist").PDFDocumentProxy>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const renderKey = `${item.id}|${item.kind}|${item.rotation}`;

  /* 图片缩略图：记录自然像素尺寸与可用容器尺寸，使旋转后布局盒随方向适配
     （transform 不改变布局盒，需我们手动按旋转后的外接盒给出尺寸，避免留白/溢出） */
  const rotWrapRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [budget, setBudget] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (item.kind !== "image") return;
    const area = rotWrapRef.current?.parentElement;
    if (!area) return;
    const measure = () => {
      const r = area.getBoundingClientRect();
      // .pfl-thumb-area padding 10px * 2；高度封顶 170px 与 CSS 保持一致
      setBudget({ w: Math.max(48, r.width - 20), h: 170 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    return () => ro.disconnect();
    // url 就绪后缩略图 wrapper 才挂载，需据此重新测量
  }, [item.kind, url]);

  useEffect(() => {
    if (item.kind !== "pdf") return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        taskRef.current?.cancel();
        const doc = await getDoc(item);
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.6, rotation: item.rotation });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setLoading(true);
        setError(false);
        const task = page.render({ canvasContext: ctx, viewport });
        taskRef.current = task;
        await task.promise;
        page.cleanup();
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (e instanceof Error && /cancel/i.test(e.message)) return;
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey, getDoc]);

  if (item.kind === "doc") {
    return (
      <div className="pfl-thumb-ph doc">
        <IconFile width={26} height={26} />
      </div>
    );
  }

  if (item.kind === "image") {
    if (!url) {
      return (
        <div className="pfl-thumb-ph">
          <IconFile width={20} height={20} />
        </div>
      );
    }
    /* 旋转 90/270 时视觉外接盒的宽高互换；据此同时给出 wrapper(=旋转后外接盒) 与
       img(=旋转前盒子) 的尺寸，再对 img 做 transform 旋转，二者恰好吻合，不留空白/不溢出 */
    const swapped = item.rotation === 90 || item.rotation === 270;
    let wrapStyle: CSSProperties | undefined;
    let fitted = false;
    const imgStyle: CSSProperties = {};
    if (nat && budget) {
      const dispW = swapped ? nat.h : nat.w;
      const dispH = swapped ? nat.w : nat.h;
      const s = Math.min(budget.w / dispW, budget.h / dispH);
      const W = Math.max(4, Math.round(dispW * s));
      const H = Math.max(4, Math.round(dispH * s));
      wrapStyle = { width: W, height: H };
      fitted = true;
      Object.assign(imgStyle, {
        width: swapped ? H : W,
        height: swapped ? W : H,
        maxWidth: "none",
        maxHeight: "none",
        transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
      });
    } else {
      imgStyle.transform = `rotate(${item.rotation}deg)`;
    }
    return (
      <div
        ref={rotWrapRef}
        className={`pfl-thumb-rot${fitted ? " is-fit" : ""}`}
        style={wrapStyle}
      >
        <img
          src={url}
          alt={item.name}
          className="pfl-thumb-img"
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={imgStyle}
        />
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="pfl-thumb-canvas" />
      {loading && (
        <div className="pfl-thumb-loading">
          <IconLoader width={16} height={16} className="spin" />
        </div>
      )}
      {error && (
        <div className="pfl-thumb-ph">
          <IconFile width={18} height={18} />
        </div>
      )}
    </>
  );
}

/* ===================== 统一文件列表 ===================== */

export function PdfFileList({ items, onChange, disabled = false, className }: PdfFileListProps) {
  const docsRef = useRef<Map<string, import("pdfjs-dist").PDFDocumentProxy>>(new Map());
  /* objectURL 用 state 存储：创建后立即触发重渲染，缩略图无需等下一次旋转才出现 */
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsLatest = useRef<Record<string, string>>({});
  const dragIdRef = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ item: PdfFileItem; pageIndex: number } | null>(null);

  const getDoc = useCallback(async (it: PdfFileItem) => {
    let doc = docsRef.current.get(it.id);
    if (!doc) {
      const pdfjs = await getPdfjs();
      const bytes = it.bytes ?? (await it.file.arrayBuffer());
      doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      docsRef.current.set(it.id, doc);
    }
    return doc;
  }, []);

  /* 图片 objectURL 生命周期：随 items 增删，卸载全部回收。
     创建/回收放在 effect 主体（不放进 setState updater，避免 StrictMode 双调用 updater 产生副作用/泄漏）。
     ref 在 effect 内同步更新，StrictMode 双跑 effect 时第二次会看到 id 已存在，不会重复创建。 */
  useEffect(() => {
    const alive = new Set(items.map((i) => i.id));
    const prev = urlsLatest.current;
    let changed = false;
    const next: Record<string, string> = {};
    for (const [id, u] of Object.entries(prev)) {
      if (alive.has(id)) next[id] = u;
      else {
        URL.revokeObjectURL(u);
        changed = true;
      }
    }
    for (const it of items) {
      if (it.kind === "image" && !(it.id in next)) {
        next[it.id] = URL.createObjectURL(it.file);
        changed = true;
      }
    }
    if (changed) {
      urlsLatest.current = next;
      setUrls(next);
    }
  }, [items]);

  /* 卸载时回收全部 objectURL（清理时读 ref 当前值，而非挂载时的空闭包） */
  useEffect(() => {
    return () => {
      for (const u of Object.values(urlsLatest.current)) URL.revokeObjectURL(u);
    };
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (id: string) => onChange(items.filter((x) => x.id !== id));

  const rotate = (id: string) =>
    onChange(items.map((x) => (x.id === id ? { ...x, rotation: nextRot(x.rotation) } : x)));

  const onDropTo = (targetId: string) => {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    setOverId(null);
    if (fromId === null || fromId === targetId) return;
    const from = items.findIndex((x) => x.id === fromId);
    const to = items.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <>
      <div className={`pfl-grid${className ? ` ${className}` : ""}`}>
        {items.map((it, i) => (
          <div
            key={it.id}
            className={`pfl-card${overId === it.id ? " pfl-drag" : ""}`}
            draggable={!disabled}
            onDragStart={(e) => {
              dragIdRef.current = it.id;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              dragIdRef.current = null;
              setOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overId !== it.id) setOverId(it.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropTo(it.id);
            }}
            style={{ cursor: disabled ? "default" : "grab" }}
          >
            <div
              className="pfl-thumb-area"
              onClick={() => setViewer({ item: it, pageIndex: 0 })}
              title="点击放大预览"
            >
              <Thumb item={it} url={urls[it.id] ?? null} getDoc={getDoc} />
              {it.rotation !== 0 && <span className="pfl-rot-badge">{it.rotation}°</span>}
            </div>
            <div className="pfl-meta">
              <span className="pfl-name" title={it.name}>
                {it.name}
              </span>
              <span className="pfl-sub">
                {it.pages ? `${it.pages} 页` : it.kind === "pdf" ? "PDF" : it.kind === "doc" ? "Word 文档" : "图片"}
                {it.extra ? ` · ${it.extra}` : null}
              </span>
              <div className="pfl-actions">
                <button
                  type="button"
                  className="btn-icon"
                  title="上移"
                  aria-label="上移"
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                >
                  <IconArrowUp width={14} height={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="下移"
                  aria-label="下移"
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === items.length - 1}
                >
                  <IconArrowDown width={14} height={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="旋转 90°"
                  aria-label="旋转 90°"
                  onClick={() => rotate(it.id)}
                  disabled={disabled}
                >
                  <IconRotateCw width={14} height={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon danger pfl-del"
                  title="移除"
                  aria-label="移除"
                  onClick={() => remove(it.id)}
                  disabled={disabled}
                >
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewer && (
        <PdfViewerModal
          open
          onClose={() => setViewer(null)}
          title={viewer.item.name}
          kind={viewer.item.kind}
          bytes={viewer.item.kind === "pdf" ? viewer.item.bytes : undefined}
          blob={viewer.item.kind === "pdf" ? (viewer.item.bytes ? undefined : viewer.item.file) : undefined}
          imageUrl={
            viewer.item.kind === "image" ? (urls[viewer.item.id] ?? undefined) : undefined
          }
          imageRotation={viewer.item.kind === "image" ? viewer.item.rotation : undefined}
          pageCount={viewer.item.pages ?? 1}
          pageIndex={viewer.pageIndex}
          onPageChange={(i) => setViewer((v) => (v ? { item: v.item, pageIndex: i } : v))}
          rotation={viewer.item.kind === "pdf" ? viewer.item.rotation : undefined}
          disabled={disabled}
        />
      )}
    </>
  );
}
