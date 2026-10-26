import { useEffect, useRef } from 'react';
import type { RobotState } from '@ino/sim-core';

import { Icon } from '@/components/Icon';
import type { OutputKind, OutputLine } from './useRunner';

const KIND_STYLE: Record<OutputKind, string> = {
  print: 'text-ink',
  warning: 'text-amber-700',
  error: 'text-danger',
  system: 'text-ink-3 italic',
};

const KIND_ICON: Record<OutputKind, string> = {
  print: 'chevron_right',
  warning: 'warning',
  error: 'error',
  system: 'info',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-1.5">
      <div className="text-[10px] tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="font-mono text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}

/**
 * Khung bên phải trong lúc chưa có robot ảo 3D (mốc M3).
 * Hiện trạng thái robot bằng số và bảng thông báo của khối "in ra".
 */
export function RunPanel({ state, output }: { state: RobotState; output: OutputLine[] }) {
  const bottom = useRef<HTMLDivElement | null>(null);

  // Luôn cuộn xuống dòng mới nhất
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [output.length]);

  const degrees = ((state.heading * 180) / Math.PI) % 360;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-50">
      <div className="shrink-0 border-b border-brand-100 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-ink-2 uppercase">
          <Icon name="smart_toy" size={15} className="text-brand" />
          Trạng thái robot
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Vị trí X" value={`${state.x.toFixed(2)} m`} />
          <Stat label="Vị trí Z" value={`${state.z.toFixed(2)} m`} />
          <Stat label="Góc quay" value={`${degrees.toFixed(0)}°`} />
          <Stat label="Bánh trái" value={`${state.left}`} />
          <Stat label="Bánh phải" value={`${state.right}`} />
          <Stat label="Thời gian" value={`${state.time.toFixed(1)} s`} />
        </div>

        <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-ink-3">
          <Icon name="info" size={14} className="mt-px shrink-0" />
          Hình robot 3D sẽ có ở mốc M3. Hiện tại chỉ hiện số liệu.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-brand-100 px-3 py-2 text-[11px] font-bold tracking-wider text-ink-2 uppercase">
          <Icon name="terminal" size={15} className="text-brand" />
          Bảng thông báo
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto bg-white px-3 py-2">
          {output.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-ink-3">
              Bấm <span className="font-semibold text-teal">Chạy</span> để xem chương trình hoạt động.
              <br />
              Dùng khối <span className="font-semibold">in ra</span> để hiện chữ ở đây.
            </p>
          ) : (
            <ul className="space-y-0.5 font-mono text-[12px] leading-relaxed">
              {output.map((line) => (
                <li key={line.id} className={`flex items-start gap-1.5 ${KIND_STYLE[line.kind]}`}>
                  <Icon name={KIND_ICON[line.kind]} size={14} className="mt-0.5 shrink-0" />
                  <span className="break-words">{line.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottom} />
        </div>
      </div>
    </div>
  );
}
