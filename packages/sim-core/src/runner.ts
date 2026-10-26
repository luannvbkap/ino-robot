// Khai báo kiểu của js-interpreter nằm ở file .d.ts cạnh đây. Nơi khác
// (apps/web) biên dịch thẳng mã nguồn này nên không tự nạp file đó — phải
// chỉ đường tường minh, nếu không sẽ báo "Could not find a declaration file".
/// <reference path="./js-interpreter.d.ts" />
import Interpreter, { type PseudoObject } from 'js-interpreter';
import { FIXED_DT, SimRobot } from './robot';
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

/** Số bước mô phỏng chạy trong mỗi khung hình, theo tốc độ đã chọn */
const SIM_STEPS_PER_FRAME: Record<Speed, number> = {
  slow: 0.25,
  normal: 1,
  fast: 4,
};

/**
 * Lệnh của robot cần chờ, kèm SỐ THAM SỐ.
 *
 * Số tham số không phải để cho đẹp: `createAsyncFunction` đọc `fn.length` rồi
 * trừ đi 1 (vì tham số cuối là callback) để biết arity. Dùng tham số rest thì
 * `fn.length` bằng 0, thành -1, và trình thông dịch vỡ với "Invalid array length".
 */
const ASYNC_METHODS: Record<string, 0 | 1 | 2> = {
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

/** Bọc lệnh chờ được, khai đúng số tham số để trình thông dịch tính arity đúng */
function wrapAsync(fn: AnyFn, arity: 0 | 1 | 2) {
  const call = (args: unknown[], callback: () => void) => {
    void (fn(...(args as never[])) as Promise<void>).then(() => callback());
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

/** Cho phép thay bộ hẹn khung hình để kiểm thử không cần trình duyệt */
export interface Scheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const rafScheduler: Scheduler = {
  request: (cb) => requestAnimationFrame(cb),
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
  /** Phần bước mô phỏng còn dư khi chạy chậm */
  private simDebt = 0;

  private readonly robot: SimRobot;
  private readonly code: string;
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
    this.robot.reset();
    this.totalSteps = 0;
    this.simDebt = 0;

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
    this.setStatus('running');
    this.scheduleFrame();
  }

  stop() {
    this.cancelFrame();
    this.interpreter = null;
    this.robot.reset();
    this.onHighlight?.(null);
    if (this.status !== 'idle') this.setStatus('stopped');
  }

  /* ----------------------------- Vòng lặp chạy --------------------------- */

  private scheduleFrame() {
    this.handle = this.scheduler.request(() => {
      this.handle = null;
      this.frame();
    });
  }

  private cancelFrame() {
    if (this.handle !== null) {
      this.scheduler.cancel(this.handle);
      this.handle = null;
    }
  }

  /** Một khung hình: chạy một ít lệnh rồi tiến mô phỏng */
  private frame() {
    if (this.status !== 'running' || !this.interpreter) return;

    try {
      if (!this.runSteps()) return;
      if (!this.advanceSimulation()) return;
      this.onFrame?.(this.robot.getState());
    } catch (error) {
      this.fail(`Chương trình gặp lỗi: ${(error as Error).message}`);
      return;
    }

    this.scheduleFrame();
  }

  /** Chạy tối đa MAX_STEPS_PER_FRAME lệnh. Trả về false nếu đã kết thúc. */
  private runSteps(): boolean {
    for (let i = 0; i < this.limits.maxStepsPerFrame; i++) {
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

  /** Tiến mô phỏng theo tốc độ đã chọn. Trả về false nếu phải dừng. */
  private advanceSimulation(): boolean {
    this.simDebt += SIM_STEPS_PER_FRAME[this.speed];

    while (this.simDebt >= 1) {
      this.robot.step(FIXED_DT);
      this.simDebt -= 1;

      if (this.robot.getState().time > this.limits.maxSimSeconds) {
        this.fail(
          `Robot đã chạy quá ${this.limits.maxSimSeconds} giây mà chương trình chưa kết thúc ` +
            'nên phải dừng lại.',
        );
        return false;
      }
    }
    return true;
  }

  private finish() {
    this.cancelFrame();
    this.onHighlight?.(null);
    this.setStatus('finished');
  }

  private fail(message: string) {
    this.cancelFrame();
    this.interpreter = null;
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
      const method = robot[name]!.bind(this.robot);
      interpreter.setProperty(
        robotObject,
        name,
        interpreter.createAsyncFunction(wrapAsync(method, arity) as never),
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
