import { describe, expect, test } from 'vitest';
import {
  ProgramRunner,
  SimRobot,
  type RunnerLimits,
  type RunnerStatus,
  type Scheduler,
} from './index';

/**
 * Bộ hẹn khung hình thủ công — thay cho requestAnimationFrame.
 * Nhờ nó, bài test kiểm soát được từng khung hình thay vì phải chờ thời gian thật.
 */
class ManualScheduler implements Scheduler {
  private pending = new Map<number, () => void>();
  private nextHandle = 1;

  request(callback: () => void) {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number) {
    this.pending.delete(handle);
  }

  /** Chạy một khung hình, kèm dọn hết microtask như trình duyệt vẫn làm */
  async tick() {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const cb of callbacks) cb();
    for (let i = 0; i < 16; i++) await Promise.resolve();
  }

  async run(frames: number) {
    for (let i = 0; i < frames && this.pending.size; i++) await this.tick();
  }

  get hasWork() {
    return this.pending.size > 0;
  }
}

interface Harness {
  runner: ProgramRunner;
  robot: SimRobot;
  scheduler: ManualScheduler;
  statuses: RunnerStatus[];
  highlights: (string | null)[];
  errors: string[];
  prints: string[];
}

function makeRunner(
  code: string,
  speed: 'slow' | 'normal' | 'fast' = 'normal',
  limits?: Partial<RunnerLimits>,
): Harness {
  const prints: string[] = [];
  const statuses: RunnerStatus[] = [];
  const highlights: (string | null)[] = [];
  const errors: string[] = [];

  const robot = new SimRobot({ onPrint: (t) => prints.push(t) });
  const scheduler = new ManualScheduler();

  const runner = new ProgramRunner({
    robot,
    code,
    speed,
    scheduler,
    limits,
    onStatus: (s) => statuses.push(s),
    onHighlight: (id) => highlights.push(id),
    onError: (m) => errors.push(m),
  });

  return { runner, robot, scheduler, statuses, highlights, errors, prints };
}

/* ------------------------------------------------------------------ */

describe('chạy chương trình', () => {
  test('chương trình đơn giản chạy tới khi kết thúc', async () => {
    const h = makeRunner('robot.forwardOn(50);\nrobot.print("xong");\n');
    h.runner.start();
    await h.scheduler.run(20);

    expect(h.runner.getStatus()).toBe('finished');
    expect(h.prints).toEqual(['xong']);
    expect(h.robot.getState().left).toBe(50);
  });

  test('lệnh có thời gian chờ đủ số giây mô phỏng rồi mới chạy tiếp', async () => {
    const h = makeRunner('robot.forward(50, 1);\nrobot.print("den noi");\n');
    h.runner.start();
    await h.scheduler.run(300);

    expect(h.runner.getStatus()).toBe('finished');
    expect(h.prints).toEqual(['den noi']);
    expect(h.robot.getState().time).toBeGreaterThanOrEqual(1);
    expect(h.robot.getState().x, 'phải đi được 0,15m trong 1 giây').toBeCloseTo(0.15, 2);
  });

  test('tô sáng khối đang chạy theo đúng mã khối', async () => {
    const h = makeRunner("highlightBlock('khoi-1');\nrobot.stop();\nhighlightBlock('khoi-2');\n");
    h.runner.start();
    await h.scheduler.run(20);

    expect(h.highlights).toContain('khoi-1');
    expect(h.highlights).toContain('khoi-2');
    expect(h.highlights.at(-1), 'chạy xong phải tắt tô sáng').toBeNull();
  });
});

describe('vòng lặp vô hạn KHÔNG làm treo', () => {
  test('lặp mãi vẫn chạy bình thường qua nhiều khung hình', async () => {
    const h = makeRunner('while (true) {\n robot.forwardOn(50);\n robot.tick();\n}\n');
    h.runner.start();
    await h.scheduler.run(30);

    // Điểm mấu chốt: chạy xong 30 khung hình mà không treo, không lỗi
    expect(h.runner.getStatus()).toBe('running');
    expect(h.errors).toHaveLength(0);
    expect(h.robot.getState().x, 'robot phải thật sự di chuyển').toBeGreaterThan(0);
  });

  test('tạm dừng rồi chạy tiếp', async () => {
    const h = makeRunner('while (true) {\n robot.forwardOn(50);\n robot.tick();\n}\n');
    h.runner.start();
    await h.scheduler.run(10);

    h.runner.pause();
    expect(h.runner.getStatus()).toBe('paused');
    const frozen = h.robot.getState().x;

    await h.scheduler.run(10);
    expect(h.robot.getState().x, 'đang tạm dừng thì không được nhúc nhích').toBe(frozen);

    h.runner.resume();
    await h.scheduler.run(10);
    expect(h.robot.getState().x).toBeGreaterThan(frozen);
  });

  test('dừng hẳn thì đặt lại robot và tắt tô sáng', async () => {
    const h = makeRunner('while (true) {\n robot.forwardOn(50);\n robot.tick();\n}\n');
    h.runner.start();
    await h.scheduler.run(10);

    h.runner.stop();
    expect(h.runner.getStatus()).toBe('stopped');
    expect(h.robot.getState().x).toBe(0);
    expect(h.robot.getState().time).toBe(0);
    expect(h.highlights.at(-1)).toBeNull();
    expect(h.scheduler.hasWork, 'không được hẹn khung hình nào nữa').toBe(false);
  });
});

describe('chặn chương trình chạy mãi không dứt', () => {
  test('chặn theo tổng số lệnh', async () => {
    const h = makeRunner('var n = 0;\nwhile (true) { n = n + 1; }\n', 'normal', {
      maxTotalSteps: 2000,
      maxSimSeconds: 99_999, // tắt mức chặn kia để chắc chắn mức này kích hoạt
    });
    h.runner.start();
    await h.scheduler.run(500);

    expect(h.runner.getStatus()).toBe('error');
    expect(h.errors[0]).toContain('quá nhiều lệnh');
  });

  test('chặn theo thời gian robot đã chạy', async () => {
    const h = makeRunner('while (true) {\n robot.forwardOn(50);\n robot.tick();\n}\n', 'normal', {
      maxSimSeconds: 0.5,
    });
    h.runner.start();
    await h.scheduler.run(500);

    expect(h.runner.getStatus()).toBe('error');
    expect(h.errors[0]).toContain('giây');
  });

  test('chương trình sai cú pháp báo lỗi thay vì vỡ', async () => {
    const h = makeRunner('robot.forward(((;');
    h.runner.start();

    expect(h.runner.getStatus()).toBe('error');
    expect(h.errors[0]).toContain('cú pháp');
  });
});

describe('tốc độ chạy', () => {
  test('chạy nhanh tiến xa hơn chạy chậm trong cùng số khung hình', async () => {
    const code = 'while (true) {\n robot.forwardOn(100);\n robot.tick();\n}\n';

    const slow = makeRunner(code, 'slow');
    slow.runner.start();
    await slow.scheduler.run(40);

    const fast = makeRunner(code, 'fast');
    fast.runner.start();
    await fast.scheduler.run(40);

    expect(fast.robot.getState().time).toBeGreaterThan(slow.robot.getState().time);
  });
});
