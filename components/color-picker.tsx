"use client";

import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

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
        <div className="absolute left-0 z-50 mt-2 w-[248px] rounded-lg border border-line bg-elev p-3 shadow-xl">
          <HexColorPicker color={value} onChange={onChange} />

          <div className="mt-3">
            <div className="mb-1.5 text-xs text-muted-foreground">预设颜色</div>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className="h-6 w-6 rounded border border-black/10 transition-transform hover:scale-110"
                  style={{ background: c }}
                  title={c}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="mt-3">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-full rounded border border-input bg-background px-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="#007ec6"
            />
          </div>
        </div>
      )}
    </div>
  );
}
