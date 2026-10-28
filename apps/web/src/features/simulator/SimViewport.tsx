import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import type { ScenarioConfig } from '@ino/shared';
import type { RobotState } from '@ino/sim-core';

import { Icon } from '@/components/Icon';
import { createInoBot } from './inoBot';
import { CameraRig, overviewCameraPos, type ViewMode } from './CameraRig';
import {
  ArenaTable,
  GoalZone,
  Obstacles,
  RobotUnderlay,
  RoomLighting,
  StartMark,
} from './SceneEnvironment';
import { Trail } from './Trail';

/** Ảnh thu nhỏ cùng tỉ lệ với hình minh hoạ trên thẻ bài làm */
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;

const QUALITY_STORAGE_KEY = 'ino-sim-quality-pref';
type QualityPref = 'auto' | 'high' | 'low';

export interface SimViewportProps {
  scenario?: ScenarioConfig;
  /** Trạng thái robot mới nhất — đọc mỗi khung hình, không qua state của React */
  state: RefObject<RobotState>;
  /** Đang chạy thì vẽ liên tục; không chạy thì chỉ vẽ khi có thay đổi, đỡ tốn máy */
  running: boolean;
  /** Nhận hàm chụp ảnh khung 3D, dùng làm ảnh thu nhỏ của bài làm */
  onCaptureReady?: (capture: (() => string | null) | null) => void;
  /** Tuỳ chọn: báo hiệu robot vừa chạm đích để bật hiệu ứng ăn mừng 1,5 giây */
  goalReached?: boolean;
  /**
   * Đổi giá trị này để buộc vẽ lại lúc đang đứng yên. Cần vì `running` không
   * phải lúc nào cũng đổi: chạy xong rồi bấm Dừng thì `running` vẫn là false,
   * robot đã về chỗ xuất phát mà hình 3D vẫn đứng ở chỗ cũ.
   */
  redrawKey?: unknown;
}

/**
 * Sa bàn 3D: mặt bàn, mặt sàn, thước đo, vạch xuất phát, đích, vật cản, vệt đường đi và robot.
 *
 * Khung này CHỈ VẼ. Mọi chuyển động do sim-core tính theo bước thời gian cố
 * định; ở đây mỗi khung hình chỉ đọc vị trí ra rồi đặt mô hình vào đúng chỗ.
 */
export default function SimViewport({
  scenario,
  state,
  running,
  onCaptureReady,
  goalReached,
  redrawKey,
}: SimViewportProps) {
  const [mode, setMode] = useState<ViewMode>('overview');
  /** Tăng lên mỗi lần bấm lại nút góc nhìn để camera quay về vị trí chuẩn */
  const [resetKey, setResetKey] = useState(0);
  const [showTrail, setShowTrail] = useState(true);

  const [qualityPref, setQualityPref] = useState<QualityPref>(() => {
    try {
      const saved = window.localStorage.getItem(QUALITY_STORAGE_KEY);
      if (saved === 'high' || saved === 'low' || saved === 'auto') return saved;
    } catch {
      // Bỏ qua nếu môi trường chặn localStorage
    }
    return 'auto';
  });

  const [autoHighQuality, setAutoHighQuality] = useState(true);
  const highQuality = qualityPref === 'auto' ? autoHighQuality : qualityPref === 'high';

  const handleToggleQuality = () => {
    const next: QualityPref = highQuality ? 'low' : 'high';
    setQualityPref(next);
    try {
      window.localStorage.setItem(QUALITY_STORAGE_KEY, next);
    } catch {
      // Bỏ qua lỗi ghi localStorage
    }
  };

  const [sx, sz] = scenario?.size ?? [2, 2];
  const span = Math.max(sx, sz);

  // Kịch bản định danh để xoá vệt khi đổi bài
  const scenarioKey = useMemo(
    () => `${sx}x${sz}-${scenario?.ground ?? 'plain'}-${scenario?.obstacles.length ?? 0}`,
    [sx, sz, scenario?.ground, scenario?.obstacles.length]
  );

  return (
    <div className="relative h-full w-full select-none">
      <Canvas
        // Bóng mềm (PCFSoft) đã bị bỏ ở Three.js r186
        shadows={highQuality ? 'percentage' : false}
        dpr={highQuality ? [1, 1.5] : [1, 1]}
        frameloop={running || mode === 'follow' ? 'always' : 'demand'}
        camera={{ fov: 45, near: 0.01, far: 50, position: overviewCameraPos(span) }}
        fallback={<NoWebGL />}
      >
        {/* Chỉ đo khi đang vẽ liên tục: lúc đứng yên cảnh chỉ vẽ khi có thay đổi,
            số khung hình/giây đo được rất thấp và sẽ bị hiểu nhầm là máy yếu */}
        {running && (
          <PerformanceMonitor
            onDecline={() => {
              if (qualityPref === 'auto') setAutoHighQuality(false);
            }}
            onIncline={() => {
              if (qualityPref === 'auto') setAutoHighQuality(true);
            }}
          />
        )}

        <RoomLighting span={span} highQuality={highQuality} />

        <ArenaTable
          width={sx}
          depth={sz}
          groundUrl={scenario?.ground}
          highQuality={highQuality}
        />

        {scenario && <StartMark scenario={scenario} />}

        {scenario?.goal && (
          <GoalZone
            position={scenario.goal.position}
            radius={scenario.goal.radius}
            goalReached={goalReached}
            running={running}
            highQuality={highQuality}
          />
        )}

        {scenario?.obstacles && scenario.obstacles.length > 0 && (
          <Obstacles obstacles={scenario.obstacles} highQuality={highQuality} />
        )}

        <Trail state={state} visible={showTrail} scenarioKey={scenarioKey} />
        <RobotUnderlay state={state} />
        <Robot state={state} />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={0.15}
          maxDistance={span * 3}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
        <CameraRig state={state} mode={mode} span={span} resetKey={resetKey} />
        <Redraw deps={[running, scenario, showTrail, highQuality, goalReached, redrawKey]} />
        <Capture onReady={onCaptureReady} />
      </Canvas>

      {/* Cụm nút điều khiển góc nhìn & hiển thị (Tiếng Việt) */}
      <div className="absolute top-2 right-2 flex flex-wrap items-center justify-end gap-1">
        <ViewButton
          icon="zoom_out_map"
          label="Toàn cảnh"
          active={mode === 'overview'}
          onClick={() => {
            setMode('overview');
            setResetKey((k) => k + 1);
          }}
        />
        <ViewButton
          icon="my_location"
          label="Bám theo robot"
          active={mode === 'follow'}
          onClick={() => {
            setMode('follow');
            setResetKey((k) => k + 1);
          }}
        />
        <ViewButton
          icon="vertical_align_bottom"
          label="Nhìn từ trên"
          active={mode === 'top'}
          onClick={() => {
            setMode('top');
            setResetKey((k) => k + 1);
          }}
        />
        <ViewButton
          icon="timeline"
          label="Vệt đường đi"
          active={showTrail}
          onClick={() => setShowTrail((v) => !v)}
        />
        <ViewButton
          icon={highQuality ? 'auto_awesome' : 'bolt'}
          label={highQuality ? 'Đẹp' : 'Nhanh'}
          active={highQuality}
          onClick={handleToggleQuality}
        />
      </div>
    </div>
  );
}

/* ------------------------------- Robot ------------------------------ */

function Robot({ state }: { state: RefObject<RobotState> }) {
  const bot = useMemo(() => createInoBot(), []);
  useEffect(() => () => bot.dispose(), [bot]);

  const lastTime = useRef(0);

  useFrame(() => {
    const s = state.current;
    if (!s) return;

    bot.object.position.set(s.x, 0, s.z);
    bot.object.rotation.y = s.heading;

    // Bánh quay theo thời gian MÔ PHỎNG: tạm dừng thì bánh đứng, chạy nhanh thì bánh quay nhanh
    const dt = s.time - lastTime.current;
    lastTime.current = s.time;
    bot.setWheelSpeeds(s.left, s.right);
    bot.update(dt > 0 ? dt : 0);
  });

  return <primitive object={bot.object} />;
}

/* --------------------------- Tiện ích nội bộ ------------------------- */

/** Ở chế độ vẽ theo yêu cầu, phải nhắc vẽ lại khi dừng chạy hoặc đổi kịch bản */
function Redraw({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Đưa ra ngoài hàm chụp ảnh khung 3D.
 * Vẽ lại ngay trước khi chụp nên không cần bật `preserveDrawingBuffer`
 * (bật thì máy yếu chạy chậm hẳn đi).
 */
function Capture({ onReady }: { onReady?: (capture: (() => string | null) | null) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!onReady) return;
    onReady(() => {
      gl.render(scene, camera);
      return snapshot(gl.domElement);
    });
    return () => onReady(null);
  }, [gl, scene, camera, onReady]);

  return null;
}

/** Cắt giữa khung hình cho đúng tỉ lệ thẻ bài làm, rồi nén JPEG cho nhẹ */
function snapshot(source: HTMLCanvasElement): string | null {
  const { width, height } = source;
  if (!width || !height) return null;

  const out = document.createElement('canvas');
  out.width = THUMB_WIDTH;
  out.height = THUMB_HEIGHT;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  const scale = Math.max(THUMB_WIDTH / width, THUMB_HEIGHT / height);
  const cropW = THUMB_WIDTH / scale;
  const cropH = THUMB_HEIGHT / scale;
  ctx.drawImage(
    source,
    (width - cropW) / 2,
    (height - cropH) / 2,
    cropW,
    cropH,
    0,
    0,
    THUMB_WIDTH,
    THUMB_HEIGHT
  );
  return out.toDataURL('image/jpeg', 0.8);
}

function ViewButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors ${
        active ? 'bg-brand text-white' : 'bg-white/90 text-ink-2 hover:bg-white'
      }`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

function NoWebGL() {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-ink-2">
      Máy tính hoặc trình duyệt này không hỗ trợ đồ hoạ 3D (WebGL), nên không hiện được robot ảo.
      Chương trình vẫn chạy và số liệu vẫn hiện bên dưới.
    </div>
  );
}
