import { Icon } from './Icon';
import { Mascot } from './Logo';

/**
 * Hình minh hoạ thẻ bài làm, chọn theo kịch bản thật của bài (không phải dữ liệu bịa).
 * Khi bài làm đã có ảnh chụp mô phỏng thật thì dùng ảnh đó thay cho hình vẽ này.
 */
export function Thumbnail({ scenarioId, src }: { scenarioId: string; src?: string | null }) {
  if (src) return <img src={src} alt="" className="h-full w-full object-cover" />;

  if (scenarioId === 'line-follow') return <LineFollowArt />;
  if (scenarioId === 'obstacle-avoid') return <ObstacleArt />;
  return <EmptyArt />;
}

function LineFollowArt() {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
      <rect width="320" height="180" fill="#f0f4fd" />
      <path
        d="M0 45H320M0 90H320M0 135H320M80 0V180M160 0V180M240 0V180"
        stroke="#dbe3f5"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
      <path
        d="M20 130 C 90 130, 80 45, 160 45 C 240 45, 230 135, 300 135"
        stroke="#111c2d"
        strokeLinecap="round"
        strokeWidth="13"
      />
      <g transform="translate(150, 25)">
        <rect x="0" y="5" width="28" height="34" rx="6" fill="#004ac6" />
        <rect x="-4" y="9" width="4" height="10" rx="1.5" fill="#0f172a" />
        <rect x="28" y="9" width="4" height="10" rx="1.5" fill="#0f172a" />
        <circle cx="9" cy="18" r="3.4" fill="#89f5e7" />
        <circle cx="19" cy="18" r="3.4" fill="#89f5e7" />
      </g>
      <text x="14" y="166" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9">
        DÒ VẠCH KẺ · 2x CẢM BIẾN LINE
      </text>
    </svg>
  );
}

function ObstacleArt() {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
      <rect width="320" height="180" fill="#eff5fc" />
      <rect x="230" y="40" width="30" height="100" rx="4" fill="#e24a4a" opacity="0.85" />
      <rect x="60" y="20" width="100" height="24" rx="4" fill="#94a3b8" opacity="0.5" />
      <g transform="translate(100, 70)">
        <rect x="0" y="0" width="40" height="40" rx="8" fill="#006a61" />
        <circle cx="36" cy="13" r="4" fill="#89f5e7" />
        <circle cx="36" cy="27" r="4" fill="#89f5e7" />
        <path d="M46 15 A 16 16 0 0 1 46 25" stroke="#00a896" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M58 8 A 28 28 0 0 1 58 32"
          stroke="#00a896"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M72 1 A 42 42 0 0 1 72 39"
          stroke="#00a896"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>
      <text x="14" y="166" fill="#64748b" fontFamily="JetBrains Mono" fontSize="9">
        TRÁNH VẬT CẢN · CẢM BIẾN SIÊU ÂM
      </text>
    </svg>
  );
}

function EmptyArt() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
        <Mascot size={36} />
      </span>
      <span className="flex items-center gap-1 text-[12px] font-medium text-ink-2">
        <Icon name="image" size={16} />
        Chưa có hình mô phỏng
      </span>
    </div>
  );
}
