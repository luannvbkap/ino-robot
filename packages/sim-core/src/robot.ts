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

/** Sai số dấu phẩy động khi so thời điểm */
const EPSILON = 1e-9;

interface Waiter {
  at: number;
  /** Gọi ĐỒNG BỘ ngay trong bước mô phỏng hết giờ */
  done: () => void;
}

/** Lệnh của robot mà bộ chạy chương trình gọi qua `execute` */
export type RobotCommand =
  | 'forwardCm'
  | 'backwardCm'
  | 'turnLeftDeg'
  | 'turnRightDeg'
  | 'forward'
  | 'backward'
  | 'turnLeftFor'
  | 'turnRightFor'
  | 'forwardOn'
  | 'backwardOn'
  | 'turnLeft'
  | 'turnRight'
  | 'drive'
  | 'stop'
  | 'wait'
  | 'tick';

/** Lệnh chuyển động liên tục — bật động cơ rồi sang lệnh sau ngay, không chờ */
type ContinuousMove = 'forwardOn' | 'backwardOn' | 'turnLeft' | 'turnRight' | 'drive';

/** Tên khối tương ứng và khối có thời gian nên dùng thay, để nhắc học sinh */
const CONTINUOUS_HINT: Record<ContinuousMove, { block: string; timed?: string }> = {
  forwardOn: { block: 'bắt đầu chạy thẳng', timed: 'đi thẳng … trong … giây' },
  backwardOn: { block: 'bắt đầu chạy lùi', timed: 'đi lùi … trong … giây' },
  turnLeft: { block: 'bắt đầu rẽ trái', timed: 'rẽ trái … trong … giây' },
  turnRight: { block: 'bắt đầu rẽ phải', timed: 'rẽ phải … trong … giây' },
  drive: { block: 'bắt đầu chạy động cơ' },
};

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

  /** Lệnh liên tục đang điều khiển động cơ, null nếu lệnh cuối là lệnh khác */
  private activeMove: ContinuousMove | null = null;
  /** Các lệnh liên tục chương trình đã gọi, và những lệnh đã thật sự được chạy ít nhất một bước */
  private issuedMoves = new Set<ContinuousMove>();
  private ranMoves = new Set<ContinuousMove>();

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
    for (const waiter of this.waiters) waiter.done();
    this.waiters = [];
    this.warnedAboutSensors = false;
    this.activeMove = null;
    this.issuedMoves.clear();
    this.ranMoves.clear();
  }

  /**
   * Nhắc học sinh về lệnh "bắt đầu …" chưa từng được chạy giây nào — thường do
   * đặt ngay trước một lệnh chuyển động khác, hoặc là khối cuối chương trình.
   *
   * Không nhắc ngay lúc lệnh bị thay: "lặp mãi { bắt đầu chạy thẳng; nếu gần
   * vật cản thì bắt đầu rẽ trái }" là cách viết đúng, chạy thẳng vẫn có lúc được
   * chạy. Chỉ lệnh KHÔNG BAO GIỜ được chạy mới chắc chắn là nhầm.
   * Bộ chạy gọi hàm này khi chương trình kết thúc hoặc bị dừng.
   */
  reportUnusedMoves() {
    for (const move of this.issuedMoves) {
      if (this.ranMoves.has(move)) continue;
      const { block, timed } = CONTINUOUS_HINT[move];
      const instead = timed ? `dùng khối "${timed}", hoặc ` : '';
      this.onWarning?.(
        `Lệnh "${block}" chưa được chạy giây nào: khối này chỉ bật động cơ rồi chuyển ngay ` +
          `sang lệnh sau, mà ngay sau nó là một lệnh chuyển động khác hoặc chương trình đã hết. ` +
          `Em hãy ${instead}đặt khối "đợi … giây" ngay sau nó.`,
      );
    }
    this.issuedMoves.clear();
  }

  /* ------------------------ Một bước mô phỏng ------------------------- */

  /**
   * Tiến một bước. `dt` luôn là FIXED_DT khi chạy thật; cho phép truyền vào
   * để kiểm thử tính được với bước nhỏ hơn.
   */
  step(dt: number = FIXED_DT) {
    const end = this.state.time + dt;

    // Lệnh hết giờ GIỮA bước thì dừng đúng lúc đó, không đợi hết bước — nếu
    // không, "quay trái 90 độ" quay lố tới một bước (2,4° ở tốc độ 50) và đi
    // hình vuông sẽ không khép kín.
    while (this.waiters.length && this.waiters[0]!.at < end - EPSILON) {
      this.integrate(this.waiters[0]!.at - this.state.time);
      this.releaseDueWaiters();
    }

    this.integrate(end - this.state.time);
    this.state.time = end;
    this.releaseDueWaiters();
  }

  /** Tiến robot thêm `dt` giây theo tốc độ hai bánh hiện tại */
  private integrate(dt: number) {
    if (dt <= 0) return;
    const { wheelBase, maxSpeed } = this.spec;

    // Thang -100…100 đổi sang mét trên giây
    const vLeft = (this.state.left / 100) * maxSpeed;
    const vRight = (this.state.right / 100) * maxSpeed;

    // Chuyển động vi sai
    const v = (vLeft + vRight) / 2;
    const omega = (vRight - vLeft) / wheelBase;

    // Dấu trừ ở z: dùng chung hệ trục với Three.js (Y lên, bên trái robot là -Z).
    // Nhờ vậy `heading` chính là `rotation.y` của mô hình 3D, không phải đổi dấu ở đâu cả.
    this.state.heading += omega * dt;
    this.state.x += v * Math.cos(this.state.heading) * dt;
    this.state.z -= v * Math.sin(this.state.heading) * dt;
    this.state.time += dt;
    if (this.activeMove) this.ranMoves.add(this.activeMove);
  }

  /** Giải phóng các lệnh đã chờ đủ thời gian */
  private releaseDueWaiters() {
    while (this.waiters.length && this.waiters[0]!.at <= this.state.time + EPSILON) {
      this.waiters.shift()!.done();
    }
  }

  /** Chờ đủ `seconds` giây mô phỏng rồi gọi `done` — đồng bộ, ngay trong bước hết giờ */
  private waitThen(seconds: number, done: () => void) {
    if (seconds <= 0) {
      done();
      return;
    }
    this.waiters.push({ at: this.state.time + seconds, done });
    this.waiters.sort((a, b) => a.at - b.at);
  }

  private waitSeconds(seconds: number): Promise<void> {
    return new Promise<void>((resolve) => this.waitThen(seconds, resolve));
  }

  private setMotors(left: number, right: number) {
    const clamp = (n: number) => Math.max(-100, Math.min(100, n));
    this.state.left = clamp(left);
    this.state.right = clamp(right);
  }

  /* ------------------- Chuyển động có thời gian ----------------------- */

  /** Chạy động cơ `seconds` giây rồi dừng — dừng ĐÚNG bước hết giờ, không chậm một nhịp */
  private moveThen(left: number, right: number, seconds: number, done: () => void) {
    this.activeMove = null;
    this.setMotors(left, right);
    this.waitThen(seconds, () => {
      this.setMotors(0, 0);
      done();
    });
  }

  private moveFor(left: number, right: number, seconds: number): Promise<void> {
    return new Promise<void>((resolve) => this.moveThen(left, right, seconds, resolve));
  }

  /* ------------------- Theo quãng đường / góc ------------------------- */

  /** Vận tốc mặt lốp (m/s) ở mức tốc độ `speed`, thang 0…100 */
  private wheelSpeed(speed: number) {
    return (Math.min(Math.abs(speed), 100) / 100) * this.spec.maxSpeed;
  }

  /** Thời gian để đi thẳng `meters` mét */
  private secondsToTravel(speed: number, meters: number) {
    const v = this.wheelSpeed(speed);
    return v > 0 && meters > 0 ? meters / v : 0;
  }

  /**
   * Thời gian để quay tại chỗ `degrees` độ. Hai bánh chạy ngược chiều cùng
   * tốc độ v nên robot quay với ω = 2v / khoảng cách hai bánh.
   */
  private secondsToTurn(speed: number, degrees: number) {
    const omega = (2 * this.wheelSpeed(speed)) / this.spec.wheelBase;
    return omega > 0 && degrees > 0 ? ((degrees * Math.PI) / 180) / omega : 0;
  }

  forwardCm(speed: number, cm: number) {
    const s = Math.abs(speed);
    return this.moveFor(s, s, this.secondsToTravel(s, cm / 100));
  }

  backwardCm(speed: number, cm: number) {
    const s = Math.abs(speed);
    return this.moveFor(-s, -s, this.secondsToTravel(s, cm / 100));
  }

  turnLeftDeg(speed: number, degrees: number) {
    const s = Math.abs(speed);
    return this.moveFor(-s, s, this.secondsToTurn(s, degrees));
  }

  turnRightDeg(speed: number, degrees: number) {
    const s = Math.abs(speed);
    return this.moveFor(s, -s, this.secondsToTurn(s, degrees));
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

  private startMove(move: ContinuousMove, left: number, right: number) {
    this.activeMove = move;
    this.issuedMoves.add(move);
    this.setMotors(left, right);
  }

  async forwardOn(speed: number) {
    this.startMove('forwardOn', speed, speed);
  }

  async backwardOn(speed: number) {
    this.startMove('backwardOn', -speed, -speed);
  }

  async turnLeft(speed: number) {
    this.startMove('turnLeft', -speed, speed);
  }

  async turnRight(speed: number) {
    this.startMove('turnRight', speed, -speed);
  }

  async drive(left: number, right: number) {
    this.startMove('drive', left, right);
  }

  async stop() {
    this.activeMove = null;
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

  /**
   * Bản dành cho bộ chạy chương trình: làm lệnh rồi gọi `done` ĐỒNG BỘ khi xong —
   * lệnh tức thời thì gọi luôn, lệnh có thời gian thì gọi trong đúng bước hết giờ.
   *
   * Không đi qua Promise vì Promise chỉ báo xong ở microtask, tức là SAU khung
   * hình: trong lúc chờ, mô phỏng đã chạy thêm vài bước với động cơ cũ — 1 bước
   * ở tốc độ vừa, 4 bước ở tốc độ nhanh — nên cùng một chương trình mà chạy nhanh
   * với chạy chậm lại ra hai quỹ đạo khác nhau.
   */
  execute(command: RobotCommand, args: number[], done: () => void) {
    const [a = 0, b = 0] = args;
    const s = Math.abs(a);
    switch (command) {
      case 'forwardCm':
        return this.moveThen(s, s, this.secondsToTravel(s, b / 100), done);
      case 'backwardCm':
        return this.moveThen(-s, -s, this.secondsToTravel(s, b / 100), done);
      case 'turnLeftDeg':
        return this.moveThen(-s, s, this.secondsToTurn(s, b), done);
      case 'turnRightDeg':
        return this.moveThen(s, -s, this.secondsToTurn(s, b), done);
      case 'forward':
        return this.moveThen(a, a, b, done);
      case 'backward':
        return this.moveThen(-a, -a, b, done);
      case 'turnLeftFor':
        return this.moveThen(-a, a, b, done);
      case 'turnRightFor':
        return this.moveThen(a, -a, b, done);
      case 'wait':
        return this.waitThen(a, done);
      case 'tick':
        return this.waitThen(FIXED_DT, done);
      case 'forwardOn':
        this.startMove('forwardOn', a, a);
        break;
      case 'backwardOn':
        this.startMove('backwardOn', -a, -a);
        break;
      case 'turnLeft':
        this.startMove('turnLeft', -a, a);
        break;
      case 'turnRight':
        this.startMove('turnRight', a, -a);
        break;
      case 'drive':
        this.startMove('drive', a, b);
        break;
      case 'stop':
        this.activeMove = null;
        this.setMotors(0, 0);
        break;
    }
    done();
  }

  print(value: unknown) {
    this.onPrint?.(String(value));
  }
}
