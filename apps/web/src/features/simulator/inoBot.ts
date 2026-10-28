import * as THREE from 'three';

export interface InoBot {
  /** Gốc của robot. Phần mô phỏng sẽ tự đặt position.x/z và rotation.y. */
  object: THREE.Group;
  /** Tốc độ hai bánh, thang -100…100 (100 = 0.3 m/s ở mặt lốp) */
  setWheelSpeeds(left: number, right: number): void;
  /** Gọi mỗi khung hình. Chỉ quay hai bánh cho đúng tốc độ (góc quay = v / bán kính × dt).
   *  Số dương là bánh lăn về phía trước (+X). Không tự di chuyển robot. */
  update(dt: number): void;
  /** Giải phóng toàn bộ geometry và material */
  dispose(): void;
}

/**
 * Tạo hình dạng khung đế (Chassis) đối xứng qua trục X, bo góc mượt mà.
 * Mặt phẳng 2D (x, y) sẽ được extrude theo trục Z rồi xoay nằm ngang trên mặt phẳng XZ.
 */
function createChassisShape(): THREE.Shape {
  const s = new THREE.Shape();
  // Bắt đầu từ mũi trước (x = 0.068), đi vòng qua nửa trên (+y) về đuôi (x = -0.080), rồi đối xứng qua nửa dưới (-y)
  s.moveTo(0.068, -0.026);
  s.lineTo(0.068, 0.026);
  s.quadraticCurveTo(0.068, 0.036, 0.058, 0.036);
  s.lineTo(0.030, 0.036);
  // Hốc tránh bánh xe (từ x = -0.030 đến +0.030, thu hẹp bề ngang xuống 0.041m để nhường chỗ cho bánh xe ở z = ±0.060m)
  s.lineTo(0.026, 0.041);
  // Hốc kéo dài tới x = -0.032: bánh bán kính 0.0325 ở độ cao mặt đế vẫn vươn tới x ≈ ±0.031
  s.lineTo(-0.032, 0.041);
  // Phần thân sau mở rộng để đặt hộp pin và mạch điều khiển
  s.lineTo(-0.038, 0.052);
  s.lineTo(-0.068, 0.052);
  s.quadraticCurveTo(-0.080, 0.052, -0.080, 0.040);
  s.lineTo(-0.080, -0.040);
  s.quadraticCurveTo(-0.080, -0.052, -0.068, -0.052);
  s.lineTo(-0.038, -0.052);
  s.lineTo(-0.032, -0.041);
  s.lineTo(0.026, -0.041);
  s.lineTo(0.030, -0.036);
  s.lineTo(0.058, -0.036);
  s.quadraticCurveTo(0.068, -0.036, 0.068, -0.026);
  return s;
}

export function createInoBot(): InoBot {
  const root = new THREE.Group();
  root.name = 'INO_Bot';

  // Mảng lưu trữ tài nguyên để giải phóng bộ nhớ trong dispose()
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // ==========================================
  // 1. KHỞI TẠO VẬT LIỆU DÙNG CHUNG (MATERIALS)
  // ==========================================
  const matChassis = trackMat(new THREE.MeshStandardMaterial({
    color: 0x004ac6, // Màu xanh chuẩn INO Bot
    roughness: 0.35,
    metalness: 0.1,
  }));
  const matMotorYellow = trackMat(new THREE.MeshStandardMaterial({
    color: 0xf5b800,
    roughness: 0.45,
    metalness: 0.05,
  }));
  const matTireBlack = trackMat(new THREE.MeshStandardMaterial({
    color: 0x1c1c1c,
    roughness: 0.9,
    metalness: 0.05,
  }));
  const matRimWhite = trackMat(new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    roughness: 0.4,
    metalness: 0.1,
  }));
  const matPcbGreen = trackMat(new THREE.MeshStandardMaterial({
    color: 0x0b5e28,
    roughness: 0.4,
    metalness: 0.15,
  }));
  const matSensorBlue = trackMat(new THREE.MeshStandardMaterial({
    color: 0x0066b8,
    roughness: 0.4,
    metalness: 0.15,
  }));
  const matMetalSilver = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd0d5dd,
    roughness: 0.25,
    metalness: 0.85,
  }));
  const matBrass = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.8,
  }));
  const matDarkPlastic = trackMat(new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.7,
    metalness: 0.1,
  }));
  const matBatteryCell = trackMat(new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.35,
    metalness: 0.25,
  }));
  const matWhitePlastic = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.05,
  }));
  const matLedEmissive = trackMat(new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0xff1100,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  }));

  // ==========================================
  // 2. KHUNG ĐẾ & THÂN ROBOT ("chassis")
  // ==========================================
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'chassis';
  root.add(chassisGroup);

  // Tấm mica/PCB chính: dày 3.5mm, mặt dưới ở y = 0.0185, mặt trên ở y = 0.022
  const chassisShape = createChassisShape();
  const chassisGeo = trackGeo(new THREE.ExtrudeGeometry(chassisShape, {
    depth: 0.0035,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 1,
    curveSegments: 8,
  }));
  // Sau khi xoay X = -PI/2: X giữ nguyên, Y(2D) -> -Z(3D) (đối xứng), Z(depth) -> +Y(3D)
  chassisGeo.rotateX(-Math.PI / 2);

  const chassisPlate = new THREE.Mesh(chassisGeo, matChassis);
  chassisPlate.position.y = 0.0185;
  chassisPlate.castShadow = true;
  chassisPlate.receiveShadow = true;
  chassisGroup.add(chassisPlate);

  // --- Hai động cơ giảm tốc vàng (TT Motor) ---
  const ttBodyGeo = trackGeo(new THREE.BoxGeometry(0.042, 0.020, 0.018));
  const ttBackMotorGeo = trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12));
  ttBackMotorGeo.rotateZ(Math.PI / 2);
  const ttBracketGeo = trackGeo(new THREE.BoxGeometry(0.014, 0.024, 0.0025));

  for (const side of [-1, 1]) {
    const motorGroup = new THREE.Group();
    motorGroup.position.set(-0.010, 0.0325, side * 0.035);

    // Hộp số vàng
    const gearBox = new THREE.Mesh(ttBodyGeo, matMotorYellow);
    gearBox.castShadow = true;
    gearBox.receiveShadow = true;
    motorGroup.add(gearBox);

    // Đuôi mô-tơ tròn màu trắng bạc phía sau
    const dcMotor = new THREE.Mesh(ttBackMotorGeo, matMetalSilver);
    dcMotor.position.set(-0.026, 0, 0);
    dcMotor.castShadow = true;
    motorGroup.add(dcMotor);

    // Gá giữ động cơ gắn vào đế, lùi về sau để không xuyên qua mạch điều khiển
    const bracket = new THREE.Mesh(ttBracketGeo, matWhitePlastic);
    bracket.position.set(-0.008, -0.003, -side * 0.010);
    bracket.castShadow = true;
    motorGroup.add(bracket);

    chassisGroup.add(motorGroup);
  }

  // --- Hộp pin 2x18650 (Đặt phía sau) ---
  // Pin nằm dọc theo trục X, lọt giữa hai mô-tơ (mô-tơ chiếm z = ±0.026…0.044)
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(-0.046, 0.022, 0);
  chassisGroup.add(batteryGroup);

  const trayGeo = trackGeo(new THREE.BoxGeometry(0.068, 0.010, 0.042));
  const trayMesh = new THREE.Mesh(trayGeo, matDarkPlastic);
  trayMesh.position.y = 0.005;
  trayMesh.castShadow = true;
  trayMesh.receiveShadow = true;
  batteryGroup.add(trayMesh);

  const cellGeo = trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.064, 14));
  cellGeo.rotateZ(Math.PI / 2); // Dọc theo trục X
  const cellCapGeo = trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.002, 10));
  cellCapGeo.rotateZ(Math.PI / 2);

  for (const offsetZ of [-0.010, 0.010]) {
    const cell = new THREE.Mesh(cellGeo, matBatteryCell);
    cell.position.set(0, 0.012, offsetZ);
    cell.castShadow = true;
    cell.receiveShadow = true;
    batteryGroup.add(cell);

    const cap = new THREE.Mesh(cellCapGeo, matMetalSilver);
    cap.position.set(0.0325, 0.012, offsetZ);
    batteryGroup.add(cap);
  }

  // --- Mạch điều khiển trung tâm (Kiểu Arduino UNO / STEM Board) ---
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0.014, 0.022, 0);
  chassisGroup.add(boardGroup);

  // 4 trụ đồng (standoffs) nâng mạch
  const standoffGeo = trackGeo(new THREE.CylinderGeometry(0.002, 0.002, 0.006, 6));
  const standoffCoords: [number, number][] = [
    [-0.018, -0.022], [-0.018, 0.022],
    [0.018, -0.022], [0.018, 0.022],
  ];
  for (const [sx, sz] of standoffCoords) {
    const post = new THREE.Mesh(standoffGeo, matBrass);
    post.position.set(sx, 0.003, sz);
    post.castShadow = true;
    boardGroup.add(post);
  }

  // Bản mạch xanh lá đậm
  const pcbGeo = trackGeo(new THREE.BoxGeometry(0.044, 0.002, 0.052));
  const pcbMesh = new THREE.Mesh(pcbGeo, matPcbGreen);
  pcbMesh.position.y = 0.007;
  pcbMesh.castShadow = true;
  pcbMesh.receiveShadow = true;
  boardGroup.add(pcbMesh);

  // Chip vi điều khiển chính (ATmega/ESP)
  const mcuGeo = trackGeo(new THREE.BoxGeometry(0.010, 0.0025, 0.022));
  const mcuMesh = new THREE.Mesh(mcuGeo, matDarkPlastic);
  mcuMesh.position.set(0.002, 0.009, 0.004);
  mcuMesh.castShadow = true;
  boardGroup.add(mcuMesh);

  // Cổng USB kim loại
  const usbGeo = trackGeo(new THREE.BoxGeometry(0.011, 0.007, 0.009));
  const usbMesh = new THREE.Mesh(usbGeo, matMetalSilver);
  usbMesh.position.set(0.015, 0.0115, -0.016);
  usbMesh.castShadow = true;
  boardGroup.add(usbMesh);

  // 2 hàng chân cắm (Pin Headers)
  const headerGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.005, 0.003));
  for (const hz of [-0.021, 0.021]) {
    const header = new THREE.Mesh(headerGeo, matDarkPlastic);
    header.position.set(0, 0.0105, hz);
    header.castShadow = true;
    boardGroup.add(header);
  }

  // Tụ điện & Nút Reset nhỏ
  const capGeo = trackGeo(new THREE.CylinderGeometry(0.0025, 0.0025, 0.005, 8));
  const cap1 = new THREE.Mesh(capGeo, matMetalSilver);
  cap1.position.set(-0.012, 0.0105, -0.010);
  boardGroup.add(cap1);

  const cap2 = new THREE.Mesh(capGeo, matMetalSilver);
  cap2.position.set(-0.012, 0.0105, -0.002);
  boardGroup.add(cap2);

  // --- Đèn LED báo trạng thái ("led") ---
  const ledGroup = new THREE.Group();
  ledGroup.name = 'led';
  ledGroup.position.set(0.026, 0.030, 0.012);
  root.add(ledGroup);

  const ledBaseGeo = trackGeo(new THREE.CylinderGeometry(0.0028, 0.0028, 0.002, 10));
  const ledBase = new THREE.Mesh(ledBaseGeo, matWhitePlastic);
  ledBase.position.y = 0.001;
  ledGroup.add(ledBase);

  const ledDomeGeo = trackGeo(new THREE.SphereGeometry(0.0025, 10, 8));
  const ledDome = new THREE.Mesh(ledDomeGeo, matLedEmissive);
  ledDome.position.y = 0.0025;
  ledDome.castShadow = true;
  ledGroup.add(ledDome);

  // --- 2 Cụm mô-đun cảm biến dò line mặt dưới (Hướng xuống sàn tại x = 0.06, z = ±0.02) ---
  const linePcbGeo = trackGeo(new THREE.BoxGeometry(0.012, 0.0015, 0.010));
  const lineSpacerGeo = trackGeo(new THREE.CylinderGeometry(0.0018, 0.0018, 0.011, 6));
  const lineOptoGeo = trackGeo(new THREE.BoxGeometry(0.006, 0.0025, 0.007));
  const diodeGeo = trackGeo(new THREE.SphereGeometry(0.0012, 6, 6));

  for (const side of [-1, 1]) {
    const sensorVis = new THREE.Group();
    sensorVis.position.set(0.060, 0, side * 0.020);
    chassisGroup.add(sensorVis);

    // Trụ nối từ gầm chassis (y = 0.0185) xuống mô-đun (y = 0.008)
    const spacer = new THREE.Mesh(lineSpacerGeo, matBrass);
    spacer.position.set(-0.002, 0.0135, 0);
    spacer.castShadow = true;
    sensorVis.add(spacer);

    // Mạch cảm biến nhỏ
    const sPcb = new THREE.Mesh(linePcbGeo, matSensorBlue);
    sPcb.position.set(0, 0.008, 0);
    sPcb.castShadow = true;
    sensorVis.add(sPcb);

    // Đầu đọc hồng ngoại TCRT5000 (Đáy ở y = 0.005, ngay điểm raycast)
    const opto = new THREE.Mesh(lineOptoGeo, matDarkPlastic);
    opto.position.set(0.001, 0.0062, 0);
    opto.castShadow = true;
    sensorVis.add(opto);

    // 2 mắt thu/phát hồng ngoại nhỏ
    const irTx = new THREE.Mesh(diodeGeo, matSensorBlue);
    irTx.position.set(0.001, 0.005, -0.0018);
    sensorVis.add(irTx);

    const irRx = new THREE.Mesh(diodeGeo, matDarkPlastic);
    irRx.position.set(0.001, 0.005, 0.0018);
    sensorVis.add(irRx);
  }

  // ==========================================
  // 3. BÁNH CẦU ĐỠ THÂN SAU ("caster")
  // ==========================================
  // Chạm sàn đúng tại y = 0.000
  const casterGroup = new THREE.Group();
  casterGroup.name = 'caster';
  casterGroup.position.set(-0.062, 0, 0);
  root.add(casterGroup);

  // Đế gắn vào gầm chassis (y từ 0.0105 đến 0.0185)
  const casterFlangeGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.012, 0.008, 14));
  const casterFlange = new THREE.Mesh(casterFlangeGeo, matWhitePlastic);
  casterFlange.position.y = 0.0145;
  casterFlange.castShadow = true;
  casterFlange.receiveShadow = true;
  casterGroup.add(casterFlange);

  // Vỏ ôm bi cầu (y từ 0.0045 đến 0.0115)
  const casterCupGeo = trackGeo(new THREE.CylinderGeometry(0.0095, 0.0085, 0.007, 14));
  const casterCup = new THREE.Mesh(casterCupGeo, matMetalSilver);
  casterCup.position.y = 0.008;
  casterCup.castShadow = true;
  casterGroup.add(casterCup);

  // Viên bi thép bán kính R = 0.006m, tâm tại y = 0.006m -> Điểm thấp nhất chạm đúng y = 0.000m
  const ballGeo = trackGeo(new THREE.SphereGeometry(0.006, 16, 12));
  const ballMesh = new THREE.Mesh(ballGeo, matMetalSilver);
  ballMesh.position.y = 0.006;
  ballMesh.castShadow = true;
  casterGroup.add(ballMesh);

  // ==========================================
  // 4. CẢM BIẾN SIÊU ÂM PHÍA TRƯỚC ("ultrasonic")
  // ==========================================
  const ultrasonicGroup = new THREE.Group();
  ultrasonicGroup.name = 'ultrasonic';
  // Đặt cụm cảm biến ở mũi robot, tâm mắt ở độ cao y = 0.032m
  ultrasonicGroup.position.set(0.058, 0.032, 0);
  root.add(ultrasonicGroup);

  // Giá đỡ chữ L gắn từ mặt chassis (y = 0.022) lên cảm biến
  const mountBaseGeo = trackGeo(new THREE.BoxGeometry(0.010, 0.002, 0.028));
  const mountBase = new THREE.Mesh(mountBaseGeo, matDarkPlastic);
  mountBase.position.set(-0.004, -0.009, 0);
  mountBase.castShadow = true;
  ultrasonicGroup.add(mountBase);

  const mountWallGeo = trackGeo(new THREE.BoxGeometry(0.0025, 0.016, 0.028));
  const mountWall = new THREE.Mesh(mountWallGeo, matDarkPlastic);
  mountWall.position.set(-0.001, -0.002, 0);
  mountWall.castShadow = true;
  ultrasonicGroup.add(mountWall);

  // Tấm mạch HC-SR04 màu xanh dương (45mm rộng x 20mm cao x 1.6mm dày)
  const hcPcbGeo = trackGeo(new THREE.BoxGeometry(0.0018, 0.020, 0.045));
  const hcPcb = new THREE.Mesh(hcPcbGeo, matSensorBlue);
  hcPcb.position.set(0.001, 0, 0);
  hcPcb.castShadow = true;
  hcPcb.receiveShadow = true;
  ultrasonicGroup.add(hcPcb);

  // Hai "mắt" siêu âm hình trụ bạc hướng về +X (tạo khuôn mặt thân thiện)
  const eyeOuterGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.011, 16));
  eyeOuterGeo.rotateZ(Math.PI / 2); // Trục hình trụ hướng dọc theo +X

  const eyeRimGeo = trackGeo(new THREE.CylinderGeometry(0.0084, 0.0084, 0.0018, 16));
  eyeRimGeo.rotateZ(Math.PI / 2);

  const eyeMeshGeo = trackGeo(new THREE.CylinderGeometry(0.0062, 0.0062, 0.001, 12));
  eyeMeshGeo.rotateZ(Math.PI / 2);

  for (const ez of [-0.013, 0.013]) {
    const eyeCyl = new THREE.Mesh(eyeOuterGeo, matMetalSilver);
    eyeCyl.position.set(0.0065, 0, ez);
    eyeCyl.castShadow = true;
    eyeCyl.receiveShadow = true;
    ultrasonicGroup.add(eyeCyl);

    const eyeRim = new THREE.Mesh(eyeRimGeo, matMetalSilver);
    eyeRim.position.set(0.0115, 0, ez);
    eyeRim.castShadow = true;
    ultrasonicGroup.add(eyeRim);

    const eyeInner = new THREE.Mesh(eyeMeshGeo, matDarkPlastic);
    eyeInner.position.set(0.0121, 0, ez);
    ultrasonicGroup.add(eyeInner);
  }

  // Thạch anh (crystal) ở giữa hai mắt giống chiếc "mũi" nhỏ của khuôn mặt robot
  const crystalGeo = trackGeo(new THREE.BoxGeometry(0.003, 0.004, 0.008));
  const crystal = new THREE.Mesh(crystalGeo, matMetalSilver);
  crystal.position.set(0.0025, -0.003, 0);
  crystal.castShadow = true;
  ultrasonicGroup.add(crystal);

  // ==========================================
  // 5. HAI BÁNH XE CHỦ ĐỘNG ("wheelLeft", "wheelRight")
  // ==========================================
  // Đường kính = 0.065m (R = 0.0325m), dày = 0.026m, khoảng cách hai bánh (wheelBase) = 0.12m
  const WHEEL_RADIUS = 0.0325;
  const WHEEL_WIDTH = 0.026;
  const HALF_WHEEL_BASE = 0.060;

  // Lốp chính (bán kính 0.0315m để phần gai lốp dày 1mm nhô ra chạm đúng R = 0.0325m)
  const tireBaseGeo = trackGeo(new THREE.CylinderGeometry(0.0315, 0.0315, WHEEL_WIDTH, 24));
  tireBaseGeo.rotateX(Math.PI / 2); // Trục bánh xe dọc theo trục Z

  // Vành xe màu trắng sáng
  const rimCoreGeo = trackGeo(new THREE.CylinderGeometry(0.0225, 0.0225, WHEEL_WIDTH + 0.0006, 20));
  rimCoreGeo.rotateX(Math.PI / 2);

  // Hốc lõm tối màu trên mâm để các nan hoa nổi bật khi bánh xe quay
  const rimRecessGeo = trackGeo(new THREE.CylinderGeometry(0.019, 0.019, WHEEL_WIDTH + 0.001, 16));
  rimRecessGeo.rotateX(Math.PI / 2);

  // Trục giữa (Hub) và 6 nan hoa (Spokes)
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.0065, 0.0065, WHEEL_WIDTH + 0.0024, 12));
  hubGeo.rotateX(Math.PI / 2);

  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.039, 0.0042, WHEEL_WIDTH + 0.0018));

  // Gai lốp (18 gân cao su quanh chu vi giúp quan sát rõ chuyển động quay)
  const treadLugGeo = trackGeo(new THREE.BoxGeometry(0.004, 0.002, WHEEL_WIDTH - 0.002));
  const NUM_LUGS = 18;
  const LUG_RADIUS = 0.0315; // Tâm khối dày 0.002 đặt ở 0.0315 -> Đỉnh gai đạt đúng 0.0325m

  function buildWheelGroup(name: string, zPos: number): THREE.Group {
    const wGroup = new THREE.Group();
    wGroup.name = name;
    wGroup.position.set(0, WHEEL_RADIUS, zPos);

    const tire = new THREE.Mesh(tireBaseGeo, matTireBlack);
    tire.castShadow = true;
    tire.receiveShadow = true;
    wGroup.add(tire);

    const rim = new THREE.Mesh(rimCoreGeo, matRimWhite);
    rim.castShadow = true;
    rim.receiveShadow = true;
    wGroup.add(rim);

    const recess = new THREE.Mesh(rimRecessGeo, matDarkPlastic);
    wGroup.add(recess);

    const hub = new THREE.Mesh(hubGeo, matRimWhite);
    hub.castShadow = true;
    wGroup.add(hub);

    // Tạo 3 thanh chữ nhật giao nhau tạo thành 6 nan hoa
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(spokeGeo, matRimWhite);
      spoke.rotation.z = (i * Math.PI) / 3;
      spoke.castShadow = true;
      wGroup.add(spoke);
    }

    // Tạo 18 gân lốp cao su
    for (let i = 0; i < NUM_LUGS; i++) {
      const angle = (i / NUM_LUGS) * Math.PI * 2;
      const lug = new THREE.Mesh(treadLugGeo, matTireBlack);
      lug.position.set(
        Math.cos(angle) * LUG_RADIUS,
        Math.sin(angle) * LUG_RADIUS,
        0
      );
      lug.rotation.z = angle + Math.PI / 2;
      lug.castShadow = true;
      wGroup.add(lug);
    }

    return wGroup;
  }

  const wheelLeft = buildWheelGroup('wheelLeft', -HALF_WHEEL_BASE);
  const wheelRight = buildWheelGroup('wheelRight', HALF_WHEEL_BASE);
  root.add(wheelLeft);
  root.add(wheelRight);

  // ==========================================
  // 6. CÁC ĐIỂM GẮN CẢM BIẾN (EMPTY OBJECT3D)
  // ==========================================
  const lineL = new THREE.Object3D();
  lineL.name = 'lineL';
  lineL.position.set(0.06, 0.005, -0.02);
  root.add(lineL);

  const lineR = new THREE.Object3D();
  lineR.name = 'lineR';
  lineR.position.set(0.06, 0.005, 0.02);
  root.add(lineR);

  const dist = new THREE.Object3D();
  dist.name = 'dist';
  dist.position.set(0.07, 0.03, 0);
  root.add(dist);

  // ==========================================
  // 7. LOGIC ĐIỀU KHIỂN ĐỘNG HỌC BÁNH XE
  // ==========================================
  const MAX_LINEAR_SPEED = 0.3; // 100 tương ứng 0.3 m/s
  let speedLeftInput = 0;
  let speedRightInput = 0;

  function setWheelSpeeds(left: number, right: number): void {
    speedLeftInput = THREE.MathUtils.clamp(left, -100, 100);
    speedRightInput = THREE.MathUtils.clamp(right, -100, 100);
  }

  function update(dt: number): void {
    if (dt <= 0) return;
    const vLeft = (speedLeftInput / 100) * MAX_LINEAR_SPEED;
    const vRight = (speedRightInput / 100) * MAX_LINEAR_SPEED;

    // Quy tắc bàn tay phải trong hệ trục của Three.js (Y hướng lên, X hướng tới, Z hướng sang phải):
    // Để phần đỉnh bánh xe (+Y) lăn về phía trước (+X), bánh xe phải quay theo chiều kim đồng hồ
    // khi nhìn từ phía +Z, tức là góc rotation.z giảm đi: dTheta = - (v / R) * dt.
    wheelLeft.rotation.z -= (vLeft / WHEEL_RADIUS) * dt;
    wheelRight.rotation.z -= (vRight / WHEEL_RADIUS) * dt;
  }

  function dispose(): void {
    for (const geo of geometries) {
      geo.dispose();
    }
    for (const mat of materials) {
      mat.dispose();
    }
    geometries.length = 0;
    materials.length = 0;
  }

  return {
    object: root,
    setWheelSpeeds,
    update,
    dispose,
  };
}
