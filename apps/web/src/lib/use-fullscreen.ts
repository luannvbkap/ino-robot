import { useCallback, useEffect, useState } from 'react';

/**
 * Bật/tắt chế độ toàn màn hình của trình duyệt.
 * Trình duyệt chỉ cho phép gọi từ thao tác thật của người dùng (bấm nút),
 * và luôn cho thoát bằng phím Esc — không chặn được, cũng không nên chặn.
 */
export function useFullscreen() {
  const [isFull, setIsFull] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* trình duyệt từ chối (ví dụ đang trong iframe) — giữ nguyên trạng thái */
    }
  }, []);

  return { isFull, toggle };
}
