import { useEffect, useRef, useState } from 'react';

/**
 * Thanh kéo để chỉnh kích thước hai khung cạnh nhau.
 * - Kéo để thay đổi kích thước
 * - Bấm đúp để đưa về mặc định
 */
export function ResizeHandle({
  axis,
  onResize,
  onReset,
  title,
}: {
  axis: 'x' | 'y';
  onResize: (delta: number) => void;
  onReset?: () => void;
  title?: string;
}) {
  const dragging = useRef(false);
  const last = useRef(0);
  const [active, setActive] = useState(false);

  function begin(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    last.current = axis === 'x' ? e.clientX : e.clientY;
    setActive(true);
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const now = axis === 'x' ? e.clientX : e.clientY;
    onResize(now - last.current);
    last.current = now;
  }

  function end() {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  const horizontal = axis === 'x';

  return (
    <div
      role="separator"
      title={title ?? 'Kéo để chỉnh kích thước · Bấm đúp để đặt lại'}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      className={`group relative z-20 flex shrink-0 items-center justify-center transition-colors ${
        horizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
      } ${active ? 'bg-brand/50' : 'bg-brand-100 hover:bg-brand/30'}`}
    >
      <span
        className={`rounded-full bg-ink-3/60 transition-opacity ${
          horizontal ? 'h-6 w-0.5' : 'h-0.5 w-6'
        } ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
      />
      {/* Vùng bắt chuột rộng hơn vạch kẻ để dễ trúng */}
      <span
        className={`absolute ${horizontal ? '-inset-x-1.5 inset-y-0' : '-inset-y-1.5 inset-x-0'}`}
      />
    </div>
  );
}

/** Lưu bố cục người dùng đã chỉnh, mở lại lần sau vẫn giữ nguyên */
export function usePersistedLayout<T extends Record<string, number | boolean>>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* trình duyệt chặn lưu trữ — bỏ qua, chỉ mất việc nhớ bố cục */
    }
  }, [key, state]);

  return [state, setState] as const;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
