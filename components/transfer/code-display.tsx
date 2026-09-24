"use client";

import { memo } from "react";

export const CodeDisplay = memo(function CodeDisplay({
  code,
  accent = false,
}: {
  code: string;
  accent?: boolean;
}) {
  return (
    <div className="flap-row" role="status" aria-label={`提取码 ${code}`}>
      {code.split("").map((d, i) => (
        <span
          key={i}
          className={`flap ${accent ? "done" : ""}`}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {d}
        </span>
      ))}
    </div>
  );
});
