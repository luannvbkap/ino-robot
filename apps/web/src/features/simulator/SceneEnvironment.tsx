import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, Lightformer, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { ScenarioConfig } from '@ino/shared';
import type { RobotState } from '@ino/sim-core';
import { startPoseOf } from './scenario';

/* ---------------------- Bối cảnh & Ánh sáng ---------------------- */

export function RoomLighting({
  span,
  highQuality,
}: {
  span: number;
  highQuality: boolean;
}) {
  return (
    <>
      <color attach="background" args={['#f2f6ff']} />
      <fog attach="fog" args={['#f2f6ff', span * 2.2, span * 5.2]} />

      <hemisphereLight args={['#ffffff', '#dce6f7', 1.35]} />
      <directionalLight
        position={[span * 0.55, span * 1.3, span * 0.65]}
        intensity={1.65}
        castShadow={highQuality}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-camera-left={-span * 0.75}
        shadow-camera-right={span * 0.75}
        shadow-camera-top={span * 0.75}
        shadow-camera-bottom={-span * 0.75}
        shadow-camera-near={0.1}
        shadow-camera-far={span * 4}
      />

      {highQuality && (
        <Environment resolution={64} frames={1}>
          <Lightformer
            form="rect"
            intensity={2}
            color="#ffffff"
            position={[0, 5, -2]}
            scale={[10, 5, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="ring"
            intensity={1.2}
            color="#86f2e4"
            position={[-4, 3, 2]}
            scale={3}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={0.9}
            color="#dbeafe"
            position={[4, 2, 3]}
            scale={[6, 3, 1]}
            target={[0, 0, 0]}
          />
        </Environment>
      )}
    </>
  );
}

/* ---------------- Mặt bàn, Sàn đấu, Thước đo & Lưới ---------------- */

/** Texture bóng tiếp xúc (Fake AO) mềm mại tạo một lần bằng Canvas 2D */
function useSoftShadowTexture(): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
      grad.addColorStop(0, 'rgba(17, 28, 45, 0.34)');
      grad.addColorStop(0.6, 'rgba(17, 28, 45, 0.12)');
      grad.addColorStop(1, 'rgba(17, 28, 45, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function ArenaTable({
  width,
  depth,
  groundUrl,
  highQuality,
}: {
  width: number;
  depth: number;
  groundUrl?: string;
  highQuality: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const [groundTex, setGroundTex] = useState<THREE.Texture | null>(null);

  // Tải ảnh sàn an toàn: nếu 404 hoặc lỗi thì giữ mặt sàn trơn
  useEffect(() => {
    if (!groundUrl) {
      setGroundTex(null);
      invalidate();
      return;
    }

    let active = true;
    let loadedTex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();

    loader.load(
      groundUrl,
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        // Mặc định PlaneGeometry xoay -PI/2 quanh trục X có:
        // U=0 ở x = -width/2 (cột trái), V=1 ở z = -depth/2 (hàng trên cùng khi flipY = true)
        tex.flipY = true;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        loadedTex = tex;
        setGroundTex(tex);
        invalidate();
      },
      undefined,
      () => {
        if (!active) return;
        setGroundTex(null);
        invalidate();
      }
    );

    return () => {
      active = false;
      if (loadedTex) loadedTex.dispose();
    };
  }, [groundUrl, invalidate]);

  const span = Math.max(width, depth);
  const boardThickness = 0.036;
  const rimHeight = 0.022;
  const rimThick = 0.024;

  return (
    <group>
      {/* Mặt phòng rộng phía dưới để sa bàn không trôi giữa khoảng không */}
      <mesh rotation-x={-Math.PI / 2} position-y={-boardThickness - 0.022} receiveShadow={highQuality}>
        <planeGeometry args={[span * 6, span * 6]} />
        <meshStandardMaterial color="#e6eefc" roughness={0.95} />
      </mesh>

      {/* Tấm thảm / Mặt bàn đỡ sa bàn có độ dày và góc bo */}
      <RoundedBox
        args={[width + 0.34, boardThickness, depth + 0.34]}
        position={[0, -boardThickness / 2 - 0.002, 0]}
        radius={0.016}
        smoothness={highQuality ? 4 : 2}
        receiveShadow={highQuality}
      >
        <meshStandardMaterial color="#d5e1f7" roughness={0.75} />
      </RoundedBox>

      {/* Mặt sàn chính nơi robot di chuyển (Y = 0) */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow={highQuality}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          key={groundTex ? 'textured' : 'plain'}
          color={groundTex ? '#ffffff' : '#f9f9ff'}
          map={groundTex}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>

      {/* Ô lưới 10 cm, vạch đậm mỗi 50 cm tinh tế */}
      <Grid
        args={[width, depth]}
        position-y={0.0006}
        cellSize={0.1}
        cellThickness={0.55}
        cellColor="#dbe4f8"
        sectionSize={0.5}
        sectionThickness={1.05}
        sectionColor="#9eb5f0"
        fadeDistance={span * 4}
      />

      {/* Gờ viền sa bàn màu xanh đậm (#00174b) */}
      {[
        {
          pos: [0, rimHeight / 2, -depth / 2 - rimThick / 2] as [number, number, number],
          size: [width + rimThick * 2, rimHeight, rimThick] as [number, number, number],
        },
        {
          pos: [0, rimHeight / 2, depth / 2 + rimThick / 2] as [number, number, number],
          size: [width + rimThick * 2, rimHeight, rimThick] as [number, number, number],
        },
        {
          pos: [-width / 2 - rimThick / 2, rimHeight / 2, 0] as [number, number, number],
          size: [rimThick, rimHeight, depth] as [number, number, number],
        },
        {
          pos: [width / 2 + rimThick / 2, rimHeight / 2, 0] as [number, number, number],
          size: [rimThick, rimHeight, depth] as [number, number, number],
        },
      ].map((edge, idx) => (
        <RoundedBox
          key={idx}
          position={edge.pos}
          args={edge.size}
          radius={0.005}
          smoothness={2}
          castShadow={highQuality}
          receiveShadow={highQuality}
        >
          <meshStandardMaterial color="#00174b" roughness={0.45} />
        </RoundedBox>
      ))}

      {/* Thước đo mỗi 50 cm dọc hai mép sàn (100% offline bằng CanvasTexture) */}
      <RulerMarks width={width} depth={depth} rimThick={rimThick} />
    </group>
  );
}

/** Tạo nhãn khoảng cách mỗi 50 cm dọc mép sàn (ví dụ "0 m", "0,5 m", "1 m"...) */
function RulerMarks({
  width,
  depth,
  rimThick,
}: {
  width: number;
  depth: number;
  rimThick: number;
}) {
  const { xStripTex, zStripTex } = useMemo(() => {
    const createStrip = (lengthM: number, isZAxis: boolean): THREE.CanvasTexture => {
      const pxPerMeter = 256;
      const wPx = Math.max(256, Math.round(lengthM * pxPerMeter));
      const hPx = 64;
      const canvas = document.createElement('canvas');
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, wPx, hPx);
        ctx.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const steps = Math.round(lengthM / 0.5);
        for (let i = 0; i <= steps; i++) {
          const distM = i * 0.5;
          const ratio = distM / lengthM;
          // Trừa mép nhẹ ở 2 đầu để chữ không bị cắt
          const xPx = Math.min(wPx - 28, Math.max(28, ratio * wPx));

          // Vạch chia nhỏ
          ctx.fillStyle = '#004ac6';
          ctx.fillRect(ratio * wPx - 1.5, isZAxis ? 0 : 0, 3, 10);

          // Nhãn số tiếng Việt dùng dấu phẩy thập phân (0,5 m)
          const formatted = distM.toFixed(1).replace('.0', '').replace('.', ',') + ' m';
          ctx.fillStyle = '#111c2d';
          ctx.fillText(formatted, xPx, 36);
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      return tex;
    };

    return {
      xStripTex: createStrip(width, false),
      zStripTex: createStrip(depth, true),
    };
  }, [width, depth]);

  useEffect(() => {
    return () => {
      xStripTex.dispose();
      zStripTex.dispose();
    };
  }, [xStripTex, zStripTex]);

  const stripWidth = 0.085;

  return (
    <group position-y={0.001}>
      {/* Thước dọc mép trước (+Z) đo trục X */}
      <mesh
        position={[0, 0, depth / 2 + rimThick + stripWidth / 2 + 0.004]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, stripWidth]} />
        <meshBasicMaterial map={xStripTex} transparent depthWrite={false} />
      </mesh>

      {/* Thước dọc mép trái (-X) đo trục Z */}
      <mesh
        position={[-width / 2 - rimThick - stripWidth / 2 - 0.004, 0, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
      >
        <planeGeometry args={[depth, stripWidth]} />
        <meshBasicMaterial map={zStripTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/* --------------------- Ô Xuất Phát & Vạch Chỉ Hướng --------------------- */

export function StartMark({ scenario }: { scenario: ScenarioConfig }) {
  const { x = 0, z = 0, heading = 0 } = startPoseOf(scenario);

  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Nền bo góc mờ
      ctx.fillStyle = 'rgba(0, 74, 198, 0.10)';
      ctx.strokeStyle = 'rgba(0, 74, 198, 0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(16, 24, 224, 208, 24);
      ctx.fill();
      ctx.stroke();

      // Vạch xuất phát kiểu kẻ ô bên phải (+X cục bộ là hướng xuất phát)
      ctx.fillStyle = 'rgba(0, 74, 198, 0.35)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(204, 34 + i * 32, 14, 16);
      }

      // Mũi tên hướng xuất phát (+X sang phải)
      ctx.fillStyle = '#004ac6';
      ctx.beginPath();
      ctx.moveTo(60, 114);
      ctx.lineTo(145, 114);
      ctx.lineTo(145, 88);
      ctx.lineTo(192, 128);
      ctx.lineTo(145, 168);
      ctx.lineTo(145, 142);
      ctx.lineTo(60, 142);
      ctx.closePath();
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, []);

  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh position={[x, 0.0012, z]} rotation={[-Math.PI / 2, 0, heading]}>
      <planeGeometry args={[0.22, 0.2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

/* --------------------- Đích & Hiệu Ứng Ăn Mừng --------------------- */

const CONFETTI_COUNT = 36;
const CONFETTI_COLORS = ['#004ac6', '#006a61', '#86f2e4', '#f59e0b', '#ec4899'];

export function GoalZone({
  position,
  radius,
  goalReached,
  running,
  highQuality,
}: {
  position: [number, number, number];
  radius: number;
  goalReached?: boolean;
  running: boolean;
  highQuality: boolean;
}) {
  const [x, , z] = position;
  const invalidate = useThree((s) => s.invalidate);

  const pulseRingRef = useRef<THREE.Mesh>(null);
  const burstRingRef = useRef<THREE.Mesh>(null);
  const confettiRef = useRef<THREE.InstancedMesh>(null);

  const celebratingRef = useRef(false);
  const celebrateElapsedRef = useRef(0);
  const prevGoalReachedRef = useRef(false);

  // Vận tốc ngẫu nhiên của các hạt pháo giấy
  const particles = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (i % 3) * 0.2;
      const speed = 0.25 + (i % 5) * 0.08;
      return {
        vx: Math.cos(angle) * speed,
        vy: 0.65 + (i % 4) * 0.18,
        vz: Math.sin(angle) * speed,
        rx: (i % 3) * 4,
        ry: ((i + 1) % 4) * 5,
        color: new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]),
      };
    });
  }, []);

  useEffect(() => {
    const mesh = confettiRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, particles[i]!.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles]);

  // Kích hoạt ăn mừng 1,5 giây (không lặp) khi goalReached chuyển sang true
  useEffect(() => {
    if (goalReached && !prevGoalReachedRef.current) {
      celebratingRef.current = true;
      celebrateElapsedRef.current = 0;
      invalidate();
    }
    if (!goalReached) {
      celebratingRef.current = false;
      celebrateElapsedRef.current = 0;
      if (burstRingRef.current) burstRingRef.current.visible = false;
      if (confettiRef.current) confettiRef.current.visible = false;
    }
    prevGoalReachedRef.current = Boolean(goalReached);
  }, [goalReached, invalidate]);

  const dummyObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);

    // 1. Hiệu ứng "thở" nhẹ cho vòng đích khi đang chạy
    if (pulseRingRef.current && (running || celebratingRef.current)) {
      const s = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.055;
      pulseRingRef.current.scale.set(s, s, 1);
    }

    // 2. Hiệu ứng ăn mừng 1.5s khi tới đích
    if (celebratingRef.current) {
      celebrateElapsedRef.current += dt;
      const t = celebrateElapsedRef.current;
      const duration = 1.5;

      if (t <= duration) {
        const progress = t / duration;

        if (burstRingRef.current) {
          burstRingRef.current.visible = true;
          const ringScale = 1 + progress * 2.2;
          burstRingRef.current.scale.set(ringScale, ringScale, 1);
          const mat = burstRingRef.current.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - progress) * 0.75;
        }

        if (confettiRef.current) {
          confettiRef.current.visible = true;
          const gravity = 1.6;
          for (let i = 0; i < CONFETTI_COUNT; i++) {
            const p = particles[i]!;
            const px = p.vx * t;
            const py = Math.max(0.005, 0.05 + p.vy * t - 0.5 * gravity * t * t);
            const pz = p.vz * t;
            const scale = Math.max(0, 1 - progress * 0.85);

            dummyObj.position.set(px, py, pz);
            dummyObj.rotation.set(p.rx * t, p.ry * t, t * 3);
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            confettiRef.current.setMatrixAt(i, dummyObj.matrix);
          }
          confettiRef.current.instanceMatrix.needsUpdate = true;
        }

        invalidate();
      } else {
        celebratingRef.current = false;
        if (burstRingRef.current) burstRingRef.current.visible = false;
        if (confettiRef.current) confettiRef.current.visible = false;
        invalidate();
      }
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Vòng ngoài "thở" */}
      <mesh ref={pulseRingRef} rotation-x={-Math.PI / 2} position-y={0.0016}>
        <ringGeometry args={[radius * 0.76, radius, 48]} />
        <meshBasicMaterial color="#006a61" />
      </mesh>

      {/* Tâm đích màu xanh ngọc sáng */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0012}>
        <circleGeometry args={[radius * 0.76, 48]} />
        <meshBasicMaterial color="#86f2e4" transparent opacity={0.42} />
      </mesh>

      {/* Vòng sáng lan tỏa khi ăn mừng */}
      <mesh ref={burstRingRef} visible={false} rotation-x={-Math.PI / 2} position-y={0.0022}>
        <ringGeometry args={[radius * 0.85, radius * 1.08, 48]} />
        <meshBasicMaterial color="#006a61" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Cột cờ và lá cờ đích */}
      <mesh position-y={0.095} castShadow={highQuality}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.19, 10]} />
        <meshStandardMaterial color="#111c2d" roughness={0.4} />
      </mesh>
      <mesh position={[0.028, 0.165, 0]} castShadow={highQuality}>
        <boxGeometry args={[0.055, 0.038, 0.003]} />
        <meshStandardMaterial color="#006a61" roughness={0.35} />
      </mesh>

      {/* Pháo giấy 3D gọn nhẹ bằng 1 InstancedMesh duy nhất */}
      <instancedMesh
        ref={confettiRef}
        args={[undefined, undefined, CONFETTI_COUNT]}
        visible={false}
        frustumCulled={false}
      >
        <planeGeometry args={[0.016, 0.01]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}

/* --------------------- Vật Cản Khối Đồ Chơi Bo Góc --------------------- */

const OBSTACLE_MAT = new THREE.MeshStandardMaterial({
  color: '#f59e0b',
  roughness: 0.42,
  metalness: 0.05,
});

export function Obstacles({
  obstacles,
  highQuality,
}: {
  obstacles: ScenarioConfig['obstacles'];
  highQuality: boolean;
}) {
  const shadowTex = useSoftShadowTexture();

  return (
    <group>
      {obstacles.map((o, i) => {
        const [ox, oy, oz] = o.position;
        const [sx, sy, sz] = o.size;
        const radius = Math.min(sx, sy, sz) * 0.14;
        return (
          <group key={i}>
            <RoundedBox
              position={[ox, oy, oz]}
              args={[sx, sy, sz]}
              radius={Math.min(radius, 0.018)}
              smoothness={highQuality ? 3 : 1}
              castShadow={highQuality}
              receiveShadow={highQuality}
              material={OBSTACLE_MAT}
            />
            {/* Bóng tiếp xúc giả (Fake AO) ngay dưới chân vật cản để luôn "đứng" vững kể cả ở chế độ Nhanh */}
            <mesh position={[ox, 0.0008, oz]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[sx * 1.28, sz * 1.28]} />
              <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* --------------- Chỉ Báo Hướng & Bóng Tiếp Xúc Dưới Gầm Robot --------------- */

const INDICATOR_SEGMENTS = 12;

export function RobotUnderlay({ state }: { state: RefObject<RobotState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const shadowTex = useSoftShadowTexture();

  // Mũi tên dải phẳng dưới gầm chỉ về +X cục bộ, tự uốn cong khi bánh trái và bánh phải khác tốc độ
  const { arrowGeo, posAttr } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    // 12 đoạn thân + 1 đầu mũi tên tam giác (3 đỉnh)
    const vertexCount = (INDICATOR_SEGMENTS + 1) * 2 + 3;
    const positions = new Float32Array(vertexCount * 3);
    const indices: number[] = [];

    for (let i = 0; i < INDICATOR_SEGMENTS; i++) {
      const v = i * 2;
      indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    const tipBase = (INDICATOR_SEGMENTS + 1) * 2;
    indices.push(tipBase, tipBase + 1, tipBase + 2);

    const pAttr = new THREE.BufferAttribute(positions, 3);
    pAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', pAttr);
    geom.setIndex(indices);
    return { arrowGeo: geom, posAttr: pAttr };
  }, []);

  useEffect(() => () => arrowGeo.dispose(), [arrowGeo]);

  const lastCurvatureRef = useRef<number | null>(null);

  useFrame(() => {
    const s = state.current;
    if (!s || !groupRef.current) return;

    groupRef.current.position.set(s.x, 0.002, s.z);
    groupRef.current.rotation.y = s.heading;

    // Tính độ cong hướng rẽ dựa trên chênh lệch vận tốc bánh trái và bánh phải
    // Trong hệ trục Y hướng lên, mặt phẳng XZ: tiến về +X, trục +Z hướng sang phải của robot
    // Khi bánh trái > bánh phải -> robot rẽ phải (+Z), ngược lại rẽ trái (-Z)
    const speedSum = Math.abs(s.left) + Math.abs(s.right);
    let turnRatio = 0;
    if (speedSum > 0.001) {
      turnRatio = THREE.MathUtils.clamp((s.left - s.right) / Math.max(speedSum, 0.08), -1, 1);
    }

    if (lastCurvatureRef.current !== null && Math.abs(turnRatio - lastCurvatureRef.current) < 0.01) {
      return;
    }
    lastCurvatureRef.current = turnRatio;

    const arr = posAttr.array as Float32Array;
    const startX = 0.045;
    const length = 0.095;
    const halfWidth = 0.011;
    const maxBendAngle = turnRatio * 0.65; // Tối đa ~37 độ

    for (let i = 0; i <= INDICATOR_SEGMENTS; i++) {
      const t = i / INDICATOR_SEGMENTS;
      const angle = t * maxBendAngle;
      const cx = startX + t * length * Math.cos(angle * 0.5);
      const cz = t * length * Math.sin(angle * 0.5);

      // Pháp tuyến ngang
      const nx = -Math.sin(angle);
      const nz = Math.cos(angle);

      const vIdx = i * 6;
      arr[vIdx] = cx + nx * halfWidth;
      arr[vIdx + 1] = 0;
      arr[vIdx + 2] = cz + nz * halfWidth;

      arr[vIdx + 3] = cx - nx * halfWidth;
      arr[vIdx + 4] = 0;
      arr[vIdx + 5] = cz - nz * halfWidth;
    }

    // Đầu mũi tên tam giác
    const endAngle = maxBendAngle;
    const baseCx = startX + length * Math.cos(endAngle * 0.5);
    const baseCz = length * Math.sin(endAngle * 0.5);
    const tx = Math.cos(endAngle);
    const tz = Math.sin(endAngle);
    const nx = -tz;
    const nz = tx;

    const headHalfW = 0.025;
    const headLen = 0.032;
    const tipIdx = (INDICATOR_SEGMENTS + 1) * 6;

    arr[tipIdx] = baseCx + nx * headHalfW;
    arr[tipIdx + 1] = 0;
    arr[tipIdx + 2] = baseCz + nz * headHalfW;

    arr[tipIdx + 3] = baseCx - nx * headHalfW;
    arr[tipIdx + 4] = 0;
    arr[tipIdx + 5] = baseCz - nz * headHalfW;

    arr[tipIdx + 6] = baseCx + tx * headLen;
    arr[tipIdx + 7] = 0;
    arr[tipIdx + 8] = baseCz + tz * headLen;

    posAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* Bóng tiếp xúc (AO) ngay dưới bụng robot giúp robot bám sàn */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0008}>
        <planeGeometry args={[0.19, 0.17]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>

      {/* Vòng sáng định vị giúp nhìn từ xa vẫn thấy rõ vị trí robot */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.078, 0.09, 36]} />
        <meshBasicMaterial color="#004ac6" transparent opacity={0.45} depthWrite={false} />
      </mesh>

      {/* Mũi tên chỉ hướng đầu robot (+X) tự cong khi rẽ */}
      <mesh geometry={arrowGeo} frustumCulled={false}>
        <meshBasicMaterial
          color="#004ac6"
          transparent
          opacity={0.62}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
