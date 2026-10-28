import { Suspense, lazy, useEffect, useRef, type RefObject } from 'react';
import type { ScenarioConfig } from '@ino/shared';
import type { RobotState } from '@ino/sim-core';

import { Icon } from '@/components/Icon';
import { Spinner } from '@/components/ui';
import type { OutputKind, OutputLine } from './useRunner';

// Three.js khá nặng — chỉ tải khi mở khung mô phỏng, trang danh sách bài làm vẫn nhẹ
const SimViewport = lazy(() => import('@/features/simulator/SimViewport'));

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
    <div className="rounded-md bg-white/90 px-1.5 py-0.5 shadow-sm backdrop-blur">
      <div className="text-[9px] tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="font-mono text-[11px] font-semibold text-ink">{value}</div>
    </div>
  );
}

export interface RunPanelProps {
  scenario?: ScenarioConfig;
  /** Trạng thái cập nhật vài lần mỗi giây — cho các con số */
  state: RobotState;
  /** Trạng thái cập nhật mỗi khung hình — cho hình 3D */
  liveState: RefObject<RobotState>;
  running: boolean;
  output: OutputLine[];
  onCaptureReady?: (capture: (() => string | null) | null) => void;
}

/**
 * Khung bên phải: robot ảo 3D ở trên, bảng thông báo của khối "in ra" ở dưới.
 */
export function RunPanel({ scenario, state, liveState, running, output, onCaptureReady }: RunPanelProps) {
  const bottom = useRef<HTMLDivElement | null>(null);

  // Luôn cuộn xuống dòng mới nhất
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [output.length]);

  // Góc trong khoảng -180°…180° cho dễ đọc
  const degrees = ((((state.heading * 180) / Math.PI + 180) % 360) + 360) % 360 - 180;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-50">
      <div className="relative min-h-[220px] flex-[3] border-b border-brand-100">
        <Suspense fallback={<Spinner label="Đang tải sa bàn 3D…" />}>
          <SimViewport
            scenario={scenario}
            state={liveState}
            running={running}
            onCaptureReady={onCaptureReady}
            redrawKey={state}
          />
        </Suspense>

        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1">
          <Stat label="X" value={`${state.x.toFixed(2)} m`} />
          <Stat label="Z" value={`${state.z.toFixed(2)} m`} />
          <Stat label="Góc" value={`${degrees.toFixed(0)}°`} />
          <Stat label="Bánh T/P" value={`${state.left} / ${state.right}`} />
          <Stat label="Thời gian" value={`${state.time.toFixed(1)} s`} />
        </div>
      </div>

      <div className="flex min-h-[120px] flex-[2] flex-col">
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
