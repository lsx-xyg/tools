export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {/* 指针 */}
        <path d="M12 9v4.2" style={{ color: "var(--accent)" }} />
        {/* 刻度 */}
        <path d="M6.8 11.6h2.4M14.8 11.6h2.4" style={{ color: "var(--ink-3)" }} />
        {/* 轴心 */}
        <circle cx="12" cy="14" r="1.15" fill="var(--accent)" stroke="none" />
        {/* 状态灯 */}
        <circle cx="17.6" cy="6.4" r="2.1" fill="#f59e0b" stroke="none" />
      </svg>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <LogoMark />
      <span className="brand-name">
        工具箱
        <span className="en">Toolbox</span>
      </span>
    </span>
  );
}
