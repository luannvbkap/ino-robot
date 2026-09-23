/**
 * Linh vật robot của INO — vẽ bằng SVG nội bộ.
 * Thiết kế gốc dùng ảnh từ CDN của Google, không dùng được lâu dài nên thay bằng SVG.
 */
export function Mascot({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <path d="M32 6v6" stroke="#004ac6" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.5" fill="#86f2e4" />
      <rect x="8" y="12" width="48" height="40" rx="13" fill="#004ac6" />
      <rect x="14" y="19" width="36" height="24" rx="9" fill="#111827" />
      <circle cx="25" cy="30" r="4.6" fill="#89f5e7" />
      <circle cx="39" cy="30" r="4.6" fill="#89f5e7" />
      <path d="M26 38q6 4 12 0" stroke="#89f5e7" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <rect x="1" y="26" width="6" height="14" rx="3" fill="#004ac6" />
      <rect x="57" y="26" width="6" height="14" rx="3" fill="#004ac6" />
    </svg>
  );
}

/** Ô vuông bo góc chứa linh vật — dùng cho favicon, avatar, ô trống */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size * 0.68} height={size * 0.68} aria-hidden="true">
        <path d="M32 6v7" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <rect x="8" y="13" width="48" height="40" rx="13" fill="currentColor" />
        <circle cx="25" cy="31" r="5" fill="#004ac6" />
        <circle cx="39" cy="31" r="5" fill="#004ac6" />
        <path d="M26 40q6 4 12 0" stroke="#004ac6" strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="1" y="27" width="6" height="13" rx="3" fill="currentColor" />
        <rect x="57" y="27" width="6" height="13" rx="3" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Logo + tên sản phẩm + huy hiệu STUDIO */
export function Wordmark({ badge = true }: { badge?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mascot size={34} />
      <span className="text-[17px] font-semibold tracking-tight text-ink">INO Robot Studio</span>
      {badge && (
        <span className="rounded-lg bg-brand-200 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-brand uppercase">
          Studio
        </span>
      )}
    </span>
  );
}
