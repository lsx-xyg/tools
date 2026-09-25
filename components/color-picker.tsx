"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sketch } from "@uiw/react-color";

const PRESETS = [
  "#007ec6", "#4c1", "#dfb317", "#fe7d37", "#e05d44", "#9f9f9f",
  "#000000", "#ffffff", "#555555", "#0f4c81", "#8b5cf6", "#ec4899",
];

const POPUP_W = 240;
const POPUP_H = 308;
const GAP = 6;

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();

    let top = btn.bottom + GAP;
    if (btn.bottom + POPUP_H + GAP > window.innerHeight - 8) {
      top = btn.top - POPUP_H - GAP;
    }
    if (top < 8) top = 8;

    let left = btn.left;
    if (left + POPUP_W > window.innerWidth - 8) {
      left = window.innerWidth - POPUP_W - 8;
    }
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <span
          className="h-4 w-4 shrink-0 rounded border border-black/10"
          style={{ background: value }}
        />
        <span className="font-mono uppercase">{value}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: POPUP_W,
              zIndex: 9999,
            }}
            className="rounded-lg border border-line bg-elev p-2 shadow-xl"
          >
            <Sketch
              color={value}
              onChange={(color) => onChange(color.hex)}
              presetColors={PRESETS}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
