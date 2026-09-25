"use client";

import { useEffect, useRef, useState } from "react";
import { Sketch } from "@uiw/react-color";

const PRESETS = [
  "#007ec6", "#4c1", "#dfb317", "#fe7d37", "#e05d44", "#9f9f9f",
  "#000000", "#ffffff", "#555555", "#0f4c81", "#8b5cf6", "#ec4899",
];

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
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

      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-lg border border-line bg-elev p-2 shadow-xl">
          <Sketch
            color={value}
            onChange={(color) => onChange(color.hex)}
            presetColors={PRESETS}
          />
        </div>
      )}
    </div>
  );
}
