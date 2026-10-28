import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RobotState } from '@ino/sim-core';

const MAX_POINTS = 2000;
const MIN_DIST_SQ = 0.01 * 0.01; // 1 cm
const RIBBON_HALF_WIDTH = 0.014; // Rộng 2.8 cm
const TRAIL_Y = 0.0018;

const COLOR_OLD = new THREE.Color('#86f2e4');
const COLOR_NEW = new THREE.Color('#004ac6');

interface TrailProps {
  state: RefObject<RobotState>;
  visible: boolean;
  scenarioKey?: string;
}

export function Trail({ state, visible, scenarioKey }: TrailProps) {
  const invalidate = useThree((s) => s.invalidate);

  // Dữ liệu lịch sử toạ độ (x, z) lưu trong mảng phẳng để tránh cấp phát đối tượng
  const pointsX = useMemo(() => new Float32Array(MAX_POINTS), []);
  const pointsZ = useMemo(() => new Float32Array(MAX_POINTS), []);
  const countRef = useRef(0);
  const lastTimeRef = useRef(-1);

  const { geometry, posAttr, colAttr } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_POINTS * 2 * 3);
    const colors = new Float32Array(MAX_POINTS * 2 * 3);
    const indices = new Uint16Array((MAX_POINTS - 1) * 6);

    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const v = i * 2;
      const idx = i * 6;
      indices[idx] = v;
      indices[idx + 1] = v + 1;
      indices[idx + 2] = v + 2;
      indices[idx + 3] = v + 1;
      indices[idx + 4] = v + 3;
      indices[idx + 5] = v + 2;
    }

    const pAttr = new THREE.BufferAttribute(positions, 3);
    pAttr.setUsage(THREE.DynamicDrawUsage);
    const cAttr = new THREE.BufferAttribute(colors, 3);
    cAttr.setUsage(THREE.DynamicDrawUsage);

    geom.setAttribute('position', pAttr);
    geom.setAttribute('color', cAttr);
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.setDrawRange(0, 0);

    return { geometry: geom, posAttr: pAttr, colAttr: cAttr };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Xoá vệt khi đổi kịch bản bài học
  useEffect(() => {
    countRef.current = 0;
    lastTimeRef.current = -1;
    geometry.setDrawRange(0, 0);
    invalidate();
  }, [scenarioKey, geometry, invalidate]);

  useFrame(() => {
    const s = state.current;
    if (!s) return;

    // Tự xoá khi thời gian mô phỏng quay về 0 (chạy lại hoặc bấm dừng/đặt lại)
    if (s.time === 0 || s.time < lastTimeRef.current) {
      if (countRef.current > 0) {
        countRef.current = 0;
        geometry.setDrawRange(0, 0);
        invalidate();
      }
      // Ghi nhận điểm xuất phát đầu tiên
      pointsX[0] = s.x;
      pointsZ[0] = s.z;
      countRef.current = 1;
      lastTimeRef.current = s.time;
      return;
    }

    lastTimeRef.current = s.time;

    const currentCount = countRef.current;
    if (currentCount === 0) {
      pointsX[0] = s.x;
      pointsZ[0] = s.z;
      countRef.current = 1;
      return;
    }

    const prevX = pointsX[currentCount - 1]!;
    const prevZ = pointsZ[currentCount - 1]!;
    const dx = s.x - prevX;
    const dz = s.z - prevZ;

    // Chỉ thêm điểm khi robot di chuyển hơn 1 cm
    if (dx * dx + dz * dz < MIN_DIST_SQ) return;

    if (currentCount >= MAX_POINTS) {
      // Dịch mảng bỏ điểm cũ nhất khi đạt trần 2000 điểm
      pointsX.copyWithin(0, 1);
      pointsZ.copyWithin(0, 1);
      pointsX[MAX_POINTS - 1] = s.x;
      pointsZ[MAX_POINTS - 1] = s.z;
      countRef.current = MAX_POINTS;
    } else {
      pointsX[currentCount] = s.x;
      pointsZ[currentCount] = s.z;
      countRef.current = currentCount + 1;
    }

    const n = countRef.current;
    if (n < 2) return;

    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    const tempColor = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const px = pointsX[i]!;
      const pz = pointsZ[i]!;

      // Vector tiếp tuyến của quỹ đạo
      let tx = 0;
      let tz = 1;
      if (i < n - 1) {
        tx = pointsX[i + 1]! - px;
        tz = pointsZ[i + 1]! - pz;
      } else {
        tx = px - pointsX[i - 1]!;
        tz = pz - pointsZ[i - 1]!;
      }
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      // Độ rộng thon nhẹ ở phần đuôi cũ để tạo hiệu ứng mờ dần tự nhiên
      const ratio = i / (n - 1);
      const halfW = RIBBON_HALF_WIDTH * (0.35 + 0.65 * ratio);

      const vIdx = i * 6;
      posArr[vIdx] = px + nx * halfW;
      posArr[vIdx + 1] = TRAIL_Y;
      posArr[vIdx + 2] = pz + nz * halfW;

      posArr[vIdx + 3] = px - nx * halfW;
      posArr[vIdx + 4] = TRAIL_Y;
      posArr[vIdx + 5] = pz - nz * halfW;

      tempColor.lerpColors(COLOR_OLD, COLOR_NEW, ratio);
      colArr[vIdx] = tempColor.r;
      colArr[vIdx + 1] = tempColor.g;
      colArr[vIdx + 2] = tempColor.b;
      colArr[vIdx + 3] = tempColor.r;
      colArr[vIdx + 4] = tempColor.g;
      colArr[vIdx + 5] = tempColor.b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, (n - 1) * 6);
  });

  return (
    <mesh geometry={geometry} visible={visible} frustumCulled={false}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.75}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
