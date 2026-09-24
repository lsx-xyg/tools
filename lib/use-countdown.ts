"use client";

import { useEffect, useState } from "react";
import { fmtCountdown } from "./limits";

/** 返回剩余时间 HH:MM:SS；首秒返回 null（避免客户端时间戳闪烁） */
export function useCountdown(target: number): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now === null ? null : fmtCountdown(target - now);
}
