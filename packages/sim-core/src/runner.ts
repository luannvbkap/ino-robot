// Khai báo kiểu của js-interpreter nằm ở file .d.ts cạnh đây. Nơi khác
// (apps/web) biên dịch thẳng mã nguồn này nên không tự nạp file đó — phải
// chỉ đường tường minh, nếu không sẽ báo "Could not find a declaration file".
/// <reference path="./js-interpreter.d.ts" />
import Interpreter, { type PseudoObject } from 'js-interpreter';
import { FIXED_DT, SimRobot, type RobotCommand } from './robot';
import { inoMap } from './maths';
import type { RobotState } from './types';

/* ------------------------------ Giới hạn ------------------------------ *
 * Cách ly thôi chưa đủ: "lặp mãi { đi thẳng }" là chương trình hợp lệ
 * nhưng chạy mãi không dứt. Xem PTTK-02 mục 10.
 * --------------------------------------------------------------------- */

/** Số lệnh chạy trong một khung hình — giữ cho giao diện không đơ */
export const MAX_STEPS_PER_FRAME = 200;

/** Thời gian mô phỏng tối đa, giây */
export const MAX_SIM_SECONDS = 300;

/**
 * Tổng số lệnh tối đa. Cần mức này vì hai mức trên không bắt được vòng lặp
 * chỉ chứa phép tính — thời gian mô phỏng đứng yên mà số lệnh tăng vô hạn.
 */
export const MAX_TOTAL_STEPS = 5_000_000;

export type RunnerStatus = 'idle' | 'running' | 'paused' | 'finished' | 'stopped' | 'error';

export type Speed = 'slow' | 'normal' | 'fast';

/** Một giây thật ứng với bao nhiêu giây mô phỏng, theo tốc độ đã chọn */
const SIM_SPEED: Record<Speed, number> = {
  slow: 0.25,
  normal: 1,
  fast: 4,
};

/**
 * Số bước mô phỏng tối đa trong một khung hình (ở tốc độ vừa) — chống
 * "vòng xoáy tử thần": máy giật, phải bù nhiều bước, càng bù càng giật thêm.
 * Xem PTTK-02 mục 7.
 */
export const MAX_CATCH_UP = 5;

/** Khung hình dài hơn mức này (chuyển tab, máy đơ) chỉ tính bằng mức này */
const MAX_FRAME_SECONDS = 0.25;

/** Sai số dấu phẩy động khi cộng dồn 1/60 nhiều lần */
const EPSILON = 1e-9;

/**
 * Lệnh của robot cần chờ, kèm SỐ THAM SỐ.
 *
 * Số tham số không phải để cho đẹp: `createAsyncFunction` đọc `fn.length` rồi
 * trừ đi 1 (vì tham số cuối là callback) để biết arity. Dùng tham số rest thì
 * `fn.length` bằng 0, thành -1, và trình thông dịch vỡ với "Invalid array length".
 */
const ASYNC_METHODS: Record<RobotCommand, 0 | 1 | 2> = {
  forwardCm: 2,
  backwardCm: 2,
  turnLeftDeg: 2,
  turnRightDeg: 2,
  forward: 2,
  backward: 2,
  turnLeftFor: 2,
  turnRightFor: 2,
  drive: 2,
  forwardOn: 1,
  backwardOn: 1,
  turnLeft: 1,
  turnRight: 1,
  wait: 1,
  stop: 0,
  tick: 0,
};

/** Lệnh trả kết quả ngay, kèm số tham số */
const SYNC_METHODS: Record<string, 0 | 1> = {
  lineSensor: 1,
  distance: 0,
  print: 1,
};

type AnyFn = (...args: never[]) => unknown;

/**
 * Bọc lệnh chờ được, khai đúng số tham số để trình thông dịch tính arity đúng.
 * Robot gọi `callback` đồng bộ khi xong lệnh — xem `SimRobot.execute`.
 */
function wrapAsync(robot: SimRobot, command: RobotCommand, arity: 0 | 1 | 2) {
  const call = (args: unknown[], callback: () => void) => {
    robot.execute(command, args.map(Number), () => callback());
  };

  if (arity === 0) return (callback: () => void) => call([], callback);
  if (arity === 1) return (a: unknown, callback: () => void) => call([a], callback);
  return (a: unknown, b: unknown, callback: () => void) => call([a, b], callback);
}

/** Bọc lệnh trả kết quả ngay */
function wrapSync(fn: AnyFn, arity: 0 | 1) {
  if (arity === 0) return () => fn();
  return (a: unknown) => fn(...([a] as never[]));
}

/**
 * Cho phép thay bộ hẹn khung hình để kiểm thử không cần trình duyệt.
 * `now` là mốc thời gian của khung hình (mili giây). Không truyền thì mỗi
 * khung hình được tính là đúng một bước mô phỏng.
 */
export interface Scheduler {
  request(callback: (now?: number) => void): number;
  cancel(handle: number): void;
}

export const rafScheduler: Scheduler = {
  request: (cb) => requestAnimationFrame((now) => cb(now)),
  cancel: (h) => cancelAnimationFrame(h),
};

export interface RunnerLimits {
  maxStepsPerFrame: number;
  maxSimSeconds: number;
  maxTotalSteps: number;
}

export const DEFAULT_LIMITS: RunnerLimits = {
  maxStepsPerFrame: MAX_STEPS_PER_FRAME,
  maxSimSeconds: MAX_SIM_SECONDS,
  maxTotalSteps: MAX_TOTAL_STEPS,
};

export interface RunnerOptions {
  robot: SimRobot;
  /** Mã JavaScript sinh ra từ khối lệnh */
  code: string;
  speed?: Speed;
  /** Vị trí xuất phát, lấy từ `robotStart` của kịch bản */
  start?: Partial<RobotState>;
  scheduler?: Scheduler;
  /** Hạ thấp để kiểm thử — bản chạy thật dùng DEFAULT_LIMITS */
  limits?: Partial<RunnerLimits>;
  onHighlight?: (blockId: string | null) => void;
  onStatus?: (status: RunnerStatus) => void;
  onError?: (message: string) => void;
  /** Gọi sau mỗi khung hình, để giao diện vẽ lại trạng thái robot */
  onFrame?: (state: Readonly<RobotState>) => void;
}

/**
 * Chạy chương trình của học sinh từng lệnh một.
 *
 * Mã chạy trong JS-Interpreter nên hoàn toàn cách ly khỏi trang web, và vì
 * chạy từng lệnh nên tạm dừng được, chạy chậm được, và vòng lặp vô hạn
 * không làm treo trình duyệt.
 */
export class ProgramRunner {
  private interpreter: Interpreter | null = null;
  private handle: number | null = null;
  private status: RunnerStatus = 'idle';
  private totalSteps = 0;
  /** Thời gian mô phỏng đã dồn lại mà chưa đủ một bước, giây */
  private accumulator = 0;
  /** Mốc thời gian của khung hình trước, mili giây */
  private lastFrameAt: number | null = null;

  private readonly robot: SimRobot;
  private readonly code: string;
  private readonly startPose?: Partial<RobotState>;
  private readonly scheduler: Scheduler;
  private readonly onHighlight?: (blockId: string | null) => void;
  private readonly onStatus?: (status: RunnerStatus) => void;
  private readonly onError?: (message: string) => void;
  private readonly onFrame?: (state: Readonly<RobotState>) => void;
  private readonly limits: RunnerLimits;
  private speed: Speed;

  constructor(options: RunnerOptions) {
    this.robot = options.robot;
    this.code = options.code;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.speed = options.speed ?? 'normal';
    this.startPose = options.start;
    this.scheduler = options.scheduler ?? rafScheduler;
    this.onHighlight = options.onHighlight;
    this.onStatus = options.onStatus;
    this.onError = options.onError;
    this.onFrame = options.onFrame;
  }

  getStatus(): RunnerStatus {
    return this.status;
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
  }

  /* ------------------------------ Điều khiển ----------------------------- */

  start() {
    this.stop();
    this.robot.reset(this.startPose);
    this.totalSteps = 0;
    this.accumulator = 0;
    this.lastFrameAt = null;

    try {
      this.interpreter = new Interpreter(this.code, (interpreter, globalObject) =>
        this.bindApi(interpreter, globalObject),
      );
    } catch (error) {
      this.fail(`Chương trình có lỗi cú pháp: ${(error as Error).message}`);
      return;
    }

    this.setStatus('running');
    this.scheduleFrame();
  }

  pause() {
    if (this.status !== 'running') return;
    this.cancelFrame();
    this.setStatus('paused');
  }

  resume() {
    if (this.status !== 'paused') return;
    // Không tính khoảng thời gian tạm dừng vào khung hình đầu tiên sau đó
    this.lastFrameAt = null;
    this.setStatus('running');
    this.scheduleFrame();
  }

  stop() {
    this.cancelFrame();
    this.interpreter = null;
    // Nhắc trước khi đặt lại robot, vì đặt lại là quên hết lệnh đã chạy
    if (this.status === 'running' || this.status === 'paused') this.robot.reportUnusedMoves();
    this.robot.reset(this.startPose);
    this.onHighlight?.(null);
    if (this.status !== 'idle') this.setStatus('stopped');
  }

  /* ----------------------------- Vòng lặp chạy --------------------------- */

  private scheduleFrame() {
    this.handle = this.scheduler.request((now) => {
      this.handle = null;
      this.frame(now);
    });
  }

  private cancelFrame() {
    if (this.handle !== null) {
      this.scheduler.cancel(this.handle);
      this.handle = null;
    }
  }

  /**
   * Một khung hình. Chương trình và mô phỏng chạy XEN KẼ: chạy chương trình
   * tới khi nó phải chờ (đợi, đi thẳng N giây, nhường bước), rồi mới tiến một
   * bước mô phỏng, rồi lại chạy chương trình…
   *
   * Nhờ vậy giữa hai bước mô phỏng, chương trình luôn đã làm xong đúng những
   * lệnh nó phải làm — bất kể một khung hình có 0, 1 hay 4 bước. Chạy chậm,
   * vừa hay nhanh, màn 60Hz hay 144Hz đều ra CÙNG một quỹ đạo.
   */
  private frame(now?: number) {
    if (this.status !== 'running' || !this.interpreter) return;

    // Khung hình đầu tiên (hoặc khi không biết giờ) tính là đúng một bước
    const elapsed =
      now !== undefined && this.lastFrameAt !== null ? (now - this.lastFrameAt) / 1000 : FIXED_DT;
    this.lastFrameAt = now ?? null;

    try {
      if (!this.runSteps()) return;

      const steps = this.takeSimSteps(elapsed);
      for (let i = 0; i < steps; i++) {
        this.robot.step(FIXED_DT);
        if (this.robot.getState().time > this.limits.maxSimSeconds) {
          this.fail(
            `Robot đã chạy quá ${this.limits.maxSimSeconds} giây mà chương trình chưa kết thúc ` +
              'nên phải dừng lại.',
          );
          return;
        }
        if (!this.runSteps()) return;
      }

      this.onFrame?.(this.robot.getState());
    } catch (error) {
      this.fail(`Chương trình gặp lỗi: ${(error as Error).message}`);
      return;
    }

    this.scheduleFrame();
  }

  /**
   * Chạy chương trình tới khi nó đứng chờ robot, tối đa MAX_STEPS_PER_FRAME
   * lệnh mỗi lượt — vòng lặp chỉ toàn phép tính thì nhường lại cho giao diện.
   * Trả về false nếu chương trình đã kết thúc hoặc bị dừng.
   */
  private runSteps(): boolean {
    for (let i = 0; i < this.limits.maxStepsPerFrame; i++) {
      if (this.interpreter!.paused_) return true;
      if (!this.interpreter!.step()) {
        this.finish();
        return false;
      }

      this.totalSteps += 1;
      if (this.totalSteps > this.limits.maxTotalSteps) {
        this.fail(
          'Chương trình đã chạy quá nhiều lệnh nên phải dừng lại. ' +
            'Có thể em đang có vòng lặp không bao giờ kết thúc.',
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Số bước mô phỏng phải chạy trong khung hình này, tính theo thời gian thật
   * đã trôi nhân với tốc độ đã chọn. Mỗi bước luôn đúng FIXED_DT.
   */
  private takeSimSteps(elapsed: number): number {
    const scale = SIM_SPEED[this.speed];
    this.accumulator += Math.min(Math.max(elapsed, 0), MAX_FRAME_SECONDS) * scale;

    const maxSteps = Math.ceil(MAX_CATCH_UP * Math.max(1, scale));
    let steps = 0;

    while (this.accumulator >= FIXED_DT - EPSILON) {
      if (steps >= maxSteps) {
        // Máy không theo kịp — bỏ phần nợ thay vì cố bù, robot chỉ chạy chậm lại
        this.accumulator = 0;
        break;
      }
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    return steps;
  }

  private finish() {
    this.cancelFrame();
    this.robot.reportUnusedMoves();
    this.onHighlight?.(null);
    this.setStatus('finished');
  }

  private fail(message: string) {
    this.cancelFrame();
    this.interpreter = null;
    this.robot.reportUnusedMoves();
    this.onHighlight?.(null);
    this.setStatus('error');
    this.onError?.(message);
  }

  private setStatus(status: RunnerStatus) {
    this.status = status;
    this.onStatus?.(status);
  }

  /* --------------------- Nối robot vào trình thông dịch ------------------- */

  private bindApi(interpreter: Interpreter, globalObject: PseudoObject) {
    const robot = this.robot as unknown as Record<string, (...args: never[]) => unknown>;

    interpreter.setProperty(
      globalObject,
      'highlightBlock',
      interpreter.createNativeFunction(((id: string) => {
        this.onHighlight?.(id);
      }) as never),
    );

    interpreter.setProperty(
      globalObject,
      'inoMap',
      interpreter.createNativeFunction(inoMap as never),
    );

    const robotObject = interpreter.nativeToPseudo({});
    interpreter.setProperty(globalObject, 'robot', robotObject);

    for (const [name, arity] of Object.entries(ASYNC_METHODS)) {
      interpreter.setProperty(
        robotObject,
        name,
        interpreter.createAsyncFunction(wrapAsync(this.robot, name as RobotCommand, arity) as never),
      );
    }

    for (const [name, arity] of Object.entries(SYNC_METHODS)) {
      const method = robot[name]!.bind(this.robot);
      interpreter.setProperty(
        robotObject,
        name,
        interpreter.createNativeFunction(wrapSync(method, arity) as never),
      );
    }
  }
}
