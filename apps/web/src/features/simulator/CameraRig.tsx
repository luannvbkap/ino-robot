import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RobotState } from '@ino/sim-core';

export type ViewMode = 'overview' | 'follow' | 'top';

/** Giao diện tối thiểu của OrbitControls cần dùng để tránh phụ thuộc kiểu nội bộ */
export interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
  update(): boolean;
}

export function overviewCameraPos(span: number): [number, number, number] {
  // Nhìn từ phía +Z: hướng +X sang phải màn hình, chừa khoảng trống dưới cho thanh số liệu
  return [0, span * 1.18, span * 0.92];
}

const FOLLOW_OFFSET = { y: 0.36, z: 0.48 };

interface CameraRigProps {
  state: RefObject<RobotState>;
  mode: ViewMode;
  span: number;
  resetKey: number;
}

export function CameraRig({ state, mode, span, resetKey }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);

  const desiredPos = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const desiredUp = useRef(new THREE.Vector3(0, 1, 0));
  const transitioning = useRef(false);
  const transitionElapsed = useRef(0);

  // Thiết lập đích đến mỗi khi đổi chế độ hoặc bấm lại nút góc nhìn
  useEffect(() => {
    if (!controls) return;
    const s = state.current;
    const rx = s?.x ?? 0;
    const rz = s?.z ?? 0;

    if (mode === 'overview') {
      const [ox, oy, oz] = overviewCameraPos(span);
      desiredPos.current.set(ox, oy, oz);
      // Dịch tâm nhìn xuống +Z một chút để chừa ~70px mép dưới cho dải số liệu
      desiredTarget.current.set(0, -span * 0.04, span * 0.08);
      desiredUp.current.set(0, 1, 0);
    } else if (mode === 'top') {
      // Nhìn thẳng từ trên xuống (+X sang phải, -Z lên trên màn hình).
      // Camera phải lệch về phía +Z so với điểm nhìn (dù chỉ 1 mm): lệch về -Z
      // thì mép trên màn hình thành +Z và cả sa bàn bị xoay ngược 180°.
      // Không đặt đúng phía trên điểm nhìn để tránh gimbal lock của OrbitControls.
      const topTargetZ = span * 0.06;
      desiredPos.current.set(0, span * 1.38, topTargetZ + 0.001);
      desiredTarget.current.set(0, 0, topTargetZ);
      desiredUp.current.set(0, 1, 0);
    } else {
      // Chế độ follow: đặt góc nhìn ban đầu phía sau robot, sau đó người dùng xoay tự do
      desiredPos.current.set(rx, FOLLOW_OFFSET.y, rz + FOLLOW_OFFSET.z);
      desiredTarget.current.set(rx, 0.03, rz);
      desiredUp.current.set(0, 1, 0);
    }

    transitioning.current = true;
    transitionElapsed.current = 0;
    invalidate();
  }, [mode, resetKey, span, controls, state, invalidate]);

  useFrame((_, delta) => {
    if (!controls) return;
    const dt = Math.min(delta, 0.1);

    // 1. Nội suy mượt khi vừa bấm chuyển chế độ camera
    if (transitioning.current) {
      transitionElapsed.current += dt;
      const alpha = 1 - Math.exp(-10 * dt);

      if (mode === 'follow' && state.current) {
        const s = state.current;
        desiredTarget.current.set(s.x, 0.03, s.z);
      }

      camera.position.lerp(desiredPos.current, alpha);
      controls.target.lerp(desiredTarget.current, alpha);
      camera.up.lerp(desiredUp.current, alpha).normalize();
      controls.update();

      const posDist = camera.position.distanceTo(desiredPos.current);
      const targetDist = controls.target.distanceTo(desiredTarget.current);

      if ((posDist < 0.003 && targetDist < 0.003) || transitionElapsed.current > 0.9) {
        transitioning.current = false;
        camera.up.set(0, 1, 0);
        controls.update();
      } else {
        invalidate();
      }
      return;
    }

    // 2. Chế độ bám theo robot: dịch chuyển cả camera và target theo robot, giữ góc xoay của học sinh
    if (mode === 'follow' && state.current) {
      const s = state.current;
      const lerpFactor = 1 - Math.exp(-12 * dt);
      const dx = (s.x - controls.target.x) * lerpFactor;
      const dz = (s.z - controls.target.z) * lerpFactor;

      if (Math.abs(dx) > 0.00005 || Math.abs(dz) > 0.00005) {
        controls.target.x += dx;
        controls.target.z += dz;
        camera.position.x += dx;
        camera.position.z += dz;
        controls.update();
      }
    }
  });

  return null;
}
