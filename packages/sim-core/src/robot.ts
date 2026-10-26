import type {
  RobotRuntime,
  RobotSpec,
  RobotState,
  SensorSource,
  SimRobotOptions,
} from './types';

/** Bước thời gian cố định — xem PTTK-02 mục 7 */
export const FIXED_DT = 1 / 60;

export const DEFAULT_SPEC: RobotSpec = {
  wheelBase: 0.12,
  maxSpeed: 0.3,
};

/**
 * Cảm biến ở mốc M2: trả giá trị cố định.
 * Cảm biến đọc thật từ sa bàn thuộc mốc M4.
 */
export const FIXED_SENSORS: SensorSource = {
  lineSensor: () => false,
  distance: () => 100,
};

interface Waiter {
  at: number;
  resolve: () => void;
}

/**
 * Robot chạy trong mô phỏng.
 *
 * Mọi chuyển động tính theo BƯỚC THỜI GIAN CỐ ĐỊNH, không theo nhịp màn hình.
 * Nhờ vậy máy 60Hz hay 144Hz đều cho kết quả giống hệt nhau — nếu không thì
 * cùng một chương trình dò line sẽ chạy đúng ở máy này mà trượt vạch ở máy kia.
 */
export class SimRobot implements RobotRuntime {
  private state: RobotState = { x: 0, z: 0, heading: 0, left: 0, right: 0, time: 0 };
  private waiters: Waiter[] = [];
  private warnedAboutSensors = false;

  private readonly spec: RobotSpec;
  private readonly sensors: SensorSource;
  private readonly onPrint?: (text: string) => void;
  private readonly onWarning?: (text: string) => void;

  constructor(options: SimRobotOptions = {}) {
    this.spec = options.spec ?? DEFAULT_SPEC;
    this.sensors = options.sensors ?? FIXED_SENSORS;
    this.onPrint = options.onPrint;
    this.onWarning = options.onWarning;
  }

  /* ----------------------------- Trạng thái ---------------------------- */

  getState(): Readonly<RobotState> {
    return { ...this.state };
  }

  reset(start?: Partial<RobotState>) {
    this.state = { x: 0, z: 0, heading: 0, left: 0, right: 0, time: 0, ...start };
    // Huỷ mọi lệnh đang chờ, nếu không chúng sẽ treo mãi sau khi dừng chương trình
    for (const waiter of this.waiters) waiter.resolve();
    this.waiters = [];
    this.warnedAboutSensors = false;
  }

  /* ------------------------ Một bước mô phỏng ------------------------- */

  /**
   * Tiến một bước. `dt` luôn là FIXED_DT khi chạy thật; cho phép truyền vào
   * để kiểm thử tính được với bước nhỏ hơn.
   */
  step(dt: number = FIXED_DT) {
    const { wheelBase, maxSpeed } = this.spec;

    // Thang -100…100 đổi sang mét trên giây
    const vLeft = (this.state.left / 100) * maxSpeed;
    const vRight = (this.state.right / 100) * maxSpeed;

    // Chuyển động vi sai
    const v = (vLeft + vRight) / 2;
    const omega = (vRight - vLeft) / wheelBase;

    this.state.heading += omega * dt;
    this.state.x += v * Math.cos(this.state.heading) * dt;
    this.state.z += v * Math.sin(this.state.heading) * dt;
    this.state.time += dt;

    this.releaseDueWaiters();
  }

  /** Giải phóng các lệnh đã chờ đủ thời gian */
  private releaseDueWaiters() {
    const EPSILON = 1e-9;
    while (this.waiters.length && this.waiters[0]!.at <= this.state.time + EPSILON) {
      this.waiters.shift()!.resolve();
    }
  }

  private waitSeconds(seconds: number): Promise<void> {
    if (seconds <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.waiters.push({ at: this.state.time + seconds, resolve });
      this.waiters.sort((a, b) => a.at - b.at);
    });
  }

  private setMotors(left: number, right: number) {
    const clamp = (n: number) => Math.max(-100, Math.min(100, n));
    this.state.left = clamp(left);
    this.state.right = clamp(right);
  }

  /* ------------------- Chuyển động có thời gian ----------------------- */

  private async moveFor(left: number, right: number, seconds: number) {
    this.setMotors(left, right);
    await this.waitSeconds(seconds);
    this.setMotors(0, 0);
  }

  forward(speed: number, seconds: number) {
    return this.moveFor(speed, speed, seconds);
  }

  backward(speed: number, seconds: number) {
    return this.moveFor(-speed, -speed, seconds);
  }

  turnLeftFor(speed: number, seconds: number) {
    return this.moveFor(-speed, speed, seconds);
  }

  turnRightFor(speed: number, seconds: number) {
    return this.moveFor(speed, -speed, seconds);
  }

  /* -------------------- Chuyển động liên tục -------------------------- */

  async forwardOn(speed: number) {
    this.setMotors(speed, speed);
  }

  async backwardOn(speed: number) {
    this.setMotors(-speed, -speed);
  }

  async turnLeft(speed: number) {
    this.setMotors(-speed, speed);
  }

  async turnRight(speed: number) {
    this.setMotors(speed, -speed);
  }

  async drive(left: number, right: number) {
    this.setMotors(left, right);
  }

  async stop() {
    this.setMotors(0, 0);
  }

  /* ----------------------------- Cảm biến ----------------------------- */

  private warnOnce() {
    if (this.warnedAboutSensors || this.sensors !== FIXED_SENSORS) return;
    this.warnedAboutSensors = true;
    this.onWarning?.(
      'Cảm biến chưa hoạt động ở phiên bản này — luôn trả về giá trị cố định. ' +
        'Cảm biến đọc thật từ sa bàn sẽ có ở mốc M4.',
    );
  }

  lineSensor(side: 'LEFT' | 'RIGHT'): boolean {
    this.warnOnce();
    return this.sensors.lineSensor(this.state, side);
  }

  distance(): number {
    this.warnOnce();
    return this.sensors.distance(this.state);
  }

  /* ----------------------------- Hệ thống ----------------------------- */

  wait(seconds: number) {
    return this.waitSeconds(seconds);
  }

  tick() {
    return this.waitSeconds(FIXED_DT);
  }

  print(value: unknown) {
    this.onPrint?.(String(value));
  }
}
