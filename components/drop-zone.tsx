"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconPlus } from "@/components/icons";
import { useDropGuard } from "@/lib/drop-guard";

export interface FileDropZoneProps {
  /** 主文案，如「拖入 PDF，或点击选择文件」 */
  label: string;
  /** 次行说明（可选），如格式 / 数量限制 */
  hint?: string;
  accept?: string;
  multiple?: boolean;
  /** 图标块内容，默认 + 号 */
  icon?: ReactNode;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 全站统一拖入组件。
 * 样式复用 globals.css 已有 .dropzone / .dropzone-inner / .dropzone-ic / .dropzone.drag
 * （横排圆角 accent 图标块 + 文案，即「拖入 PDF」样式）。
 * 支持真实 dragover/drop、点击触发隐藏 input、拖入高亮、键盘可达（Enter/Space）。
 */
export function FileDropZone({
  label,
  hint,
  accept,
  multiple = false,
  icon,
  onFiles,
  disabled = false,
  className,
}: FileDropZoneProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const depthRef = useRef(0);
  const { register, unregister } = useDropGuard();

  /* 注册为全局拖放接收器：文件拖到页面任意位置（非本组件上）时，遮罩路由会交给 onFiles */
  useEffect(() => {
    register({ id, label, accept, multiple, disabled, onFiles });
    return () => unregister(id);
  }, [register, unregister, id, label, accept, multiple, disabled, onFiles]);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  /* 只对「拖入文件」响应：纯文本 / 链接拖拽不高亮、不拦截（保持浏览器默认） */
  const hasFiles = useCallback((e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files"), []);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      depthRef.current += 1;
      setDrag(true);
    },
    [hasFiles, disabled],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    [hasFiles],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setDrag(false);
    },
    [hasFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = 0;
      setDrag(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
    [hasFiles, disabled, multiple, onFiles],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
    },
    [disabled, openPicker],
  );

  return (
    <div
      className={`dropzone${drag ? " drag" : ""}${className ? ` ${className}` : ""}`}
      onClick={openPicker}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
    >
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="dropzone-inner" aria-hidden="true">
        <span className="dropzone-ic">{icon ?? <IconPlus width={18} height={18} />}</span>
        {hint ? (
          <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
            <span className="dz-main">{label}</span>
            <span className="dz-sub">{hint}</span>
          </span>
        ) : (
          <span className="dz-main">{label}</span>
        )}
      </div>
    </div>
  );
}
