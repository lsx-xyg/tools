"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 截断文本 + 悬浮完整提示（兜底策略）：
 * - 仅当文本真正溢出（被省略号截断）时才启用 tooltip，未截断不弹
 * - hover 显示完整内容浮层，随滚动/缩放跟随定位
 * - 空间不足时自动翻转到元素上方
 */
export function TruncatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, flip: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [text]);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 292));
    const flip = r.bottom + 12 > window.innerHeight - 8;
    setPos({ x, y: flip ? r.top - 10 : r.bottom + 10, flip });
  }, []);

  useEffect(() => {
    if (!show) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [show, place]);

  return (
    <span
      ref={ref}
      className={`tt-text ${className ?? ""}`}
      onMouseEnter={() => {
        if (truncated) {
          place();
          setShow(true);
        }
      }}
      onMouseLeave={() => setShow(false)}
    >
      {text}
      {show &&
        truncated &&
        createPortal(
          <div
            className="tt"
            role="tooltip"
            style={{
              left: pos.x,
              top: pos.y,
              ...(pos.flip ? { transform: "translateY(-100%)" } : {}),
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}
