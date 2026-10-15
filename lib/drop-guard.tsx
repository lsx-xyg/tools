"use client";

/* 全局拖放防护（DropGuard）：
   1. window 级拦截「文件拖入页面」的默认行为——文件拖到 dropzone 以外任意位置时，
      浏览器默认会把文件直接导航打开（体验灾难），这里统一 preventDefault 阻止；
   2. 拖到非 dropzone 区域时显示全屏遮罩「松开以添加文件」，drop 后把文件路由给
      当前页面注册的接收器（FileDropZone 自动注册）；
   3. dropzone 局部拖入仍走组件自身高亮与 onDrop（stopPropagation 后 window 不再重复处理）。
   对齐 react-dropzone 等业界组件的窗口级行为。 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { IconUpload } from "@/components/icons";

export interface DropReceiver {
  id: string;
  /** 显示在遮罩上的上传目标说明（如「拖入 PDF，或点击选择文件」） */
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

interface DropGuardCtx {
  register: (r: DropReceiver) => void;
  unregister: (id: string) => void;
}

const Ctx = createContext<DropGuardCtx | null>(null);

function latestReceiver(map: Map<string, DropReceiver>): DropReceiver | null {
  const alive = [...map.values()].filter((r) => !r.disabled);
  return alive.length ? alive[alive.length - 1] : null;
}

export function DropGuardProvider({ children }: { children: ReactNode }) {
  const receiversRef = useRef<Map<string, DropReceiver>>(new Map());
  const [over, setOver] = useState(false);
  const [activeLabel, setActiveLabel] = useState("");

  const register = useCallback((r: DropReceiver) => {
    receiversRef.current.set(r.id, { ...r });
  }, []);
  const unregister = useCallback((id: string) => {
    receiversRef.current.delete(id);
  }, []);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const inDropZone = (e: DragEvent) => (e.target as Element | null)?.closest?.(".dropzone") != null;

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      /* dropzone 内部由组件自身高亮处理（其合成事件 stopPropagation，到不了这里）；
         只有拖到非 dropzone 区域才需要全局遮罩 */
      if (inDropZone(e)) return;
      const r = latestReceiver(receiversRef.current);
      if (r) {
        setActiveLabel(r.label);
        setOver(true);
      }
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      /* 关键：阻止浏览器把文件当作导航目标直接打开 */
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      /* 拖出窗口（relatedTarget 为空或坐标出界）时收起遮罩 */
      if (e.relatedTarget === null || (e.clientX === 0 && e.clientY === 0)) {
        setOver(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setOver(false);
      /* dropzone 内的 drop 已由组件自身处理（stopPropagation），这里只处理全局区域 */
      if (inDropZone(e)) return;
      const r = latestReceiver(receiversRef.current);
      if (!r) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) r.onFiles(r.multiple ? files : files.slice(0, 1));
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <Ctx.Provider value={{ register, unregister }}>
      {children}
      {over && (
        <div className="drop-overlay" role="presentation" aria-hidden="true">
          <div className="drop-overlay-inner">
            <span className="drop-overlay-ic">
              <IconUpload width={34} height={34} />
            </span>
            <span className="drop-overlay-main">松开以添加文件</span>
            <span className="drop-overlay-sub" title={activeLabel}>
              {activeLabel}
            </span>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDropGuard(): DropGuardCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDropGuard 必须在 DropGuardProvider 内使用");
  return v;
}
