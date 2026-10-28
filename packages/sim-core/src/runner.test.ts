import { describe, expect, test } from 'vitest';
import {
  MAX_CATCH_UP,
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
  private pending = new Map<number, (now?: number) => void>();
  private nextHandle = 1;
  /** Đồng hồ giả, mili giây — tăng mỗi khung hình nếu có đặt `frameMs` */
  now = 0;
  /** Độ dài một khung hình. Bỏ trống = không báo giờ, mỗi khung hình đúng một bước */
  frameMs: number | undefined;

  request(callback: (now?: number) => void) {
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
    const now = this.frameMs === undefined ? undefined : (this.now += this.frameMs);
    for (const cb of callbacks) cb(now);
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

describe('bước thời gian cố định theo thời gian thật', () => {
  const LOOP = 'while (true) {\n robot.forwardOn(100);\n robot.tick();\n}\n';

  /** Chạy đúng `seconds` giây thật ở màn hình `hz`, trả về trạng thái robot */
  async function runFor(hz: number, seconds: number, speed: 'slow' | 'normal' | 'fast' = 'normal') {
    const h = makeRunner(LOOP, speed);
    h.scheduler.frameMs = 1000 / hz;
    h.runner.start();
    await h.scheduler.run(Math.round(hz * seconds));
    return h.robot.getState();
  }

  test('màn 30Hz, 60Hz, 144Hz chạy 1 giây thật đều ra khoảng 1 giây mô phỏng', async () => {
    for (const hz of [30, 60, 144]) {
      const s = await runFor(hz, 1);
      // Lệch tối đa một bước, do khung hình đầu tiên chưa biết giờ
      expect(Math.abs(s.time - 1), `${hz}Hz`).toBeLessThanOrEqual(2 / 60);
    }
  });

  test('cùng thời gian thật thì robot đi cùng quãng đường, bất kể tần số màn hình', async () => {
    const a = await runFor(60, 2);
    const b = await runFor(144, 2);
    expect(b.x).toBeCloseTo(a.x, 1);
  });

  test('tốc độ nhanh và chậm nhân đúng thời gian mô phỏng', async () => {
    const fast = await runFor(60, 1, 'fast');
    const slow = await runFor(60, 4, 'slow');
    expect(fast.time).toBeCloseTo(4, 1);
    expect(slow.time).toBeCloseTo(1, 1);
  });

  test('máy đơ một khung hình dài không làm robot nhảy cóc', async () => {
    const h = makeRunner(LOOP);
    h.scheduler.frameMs = 1000 / 60;
    h.runner.start();
    await h.scheduler.run(10);
    const before = h.robot.getState().time;

    // Một khung hình kéo dài 3 giây
    h.scheduler.frameMs = 3000;
    await h.scheduler.tick();

    const jumped = h.robot.getState().time - before;
    expect(jumped).toBeLessThanOrEqual(MAX_CATCH_UP / 60 + 1e-9);
  });

  test('thời gian tạm dừng không bị tính vào mô phỏng', async () => {
    const h = makeRunner(LOOP);
    h.scheduler.frameMs = 1000 / 60;
    h.runner.start();
    await h.scheduler.run(30);

    h.runner.pause();
    h.scheduler.now += 10_000; // ngồi chờ 10 giây
    h.runner.resume();
    const before = h.robot.getState().time;
    await h.scheduler.run(1);

    expect(h.robot.getState().time - before).toBeLessThanOrEqual(1 / 60 + 1e-9);
  });
});

describe('vị trí xuất phát', () => {
  test('robot bắt đầu và quay về đúng vị trí của kịch bản', async () => {
    const robot = new SimRobot();
    const scheduler = new ManualScheduler();
    const start = { x: 0.5, z: -0.3, heading: Math.PI / 2 };
    const runner = new ProgramRunner({ robot, code: 'robot.forward(50, 1);', scheduler, start });

    runner.start();
    expect(robot.getState()).toMatchObject(start);

    await scheduler.run(30);
    expect(robot.getState().z, 'quay trái 90° rồi tiến là đi về -Z').toBeLessThan(start.z);

    runner.stop();
    expect(robot.getState()).toMatchObject({ ...start, time: 0 });
  });
});

describe('nhắc lệnh "bắt đầu …" chưa được chạy', () => {
  function setup(code: string) {
    const warnings: string[] = [];
    const robot = new SimRobot({ onWarning: (t) => warnings.push(t) });
    const scheduler = new ManualScheduler();
    const runner = new ProgramRunner({ robot, code, scheduler });
    return { robot, scheduler, runner, warnings };
  }

  test('"bắt đầu rẽ trái" đặt ngay trước "đi thẳng" thì nhắc, robot không rẽ', async () => {
    // Đúng chương trình học sinh đã viết: đi thẳng 1s, rẽ trái (liên tục), đi thẳng 1s
    const h = setup('robot.forward(50, 1);\nrobot.turnLeft(100);\nrobot.forward(50, 1);\n');
    h.runner.start();
    await h.scheduler.run(300);

    expect(h.runner.getStatus()).toBe('finished');
    expect(h.robot.getState().heading).toBeCloseTo(0, 6);
    expect(h.warnings).toHaveLength(1);
    expect(h.warnings[0]).toContain('bắt đầu rẽ trái');
    expect(h.warnings[0]).toContain('rẽ trái … trong … giây');
  });

  test('"bắt đầu chạy thẳng" là khối cuối cùng thì nhắc', async () => {
    const h = setup('robot.forwardOn(50);\n');
    h.runner.start();
    await h.scheduler.run(10);
    expect(h.warnings).toHaveLength(1);
    expect(h.warnings[0]).toContain('bắt đầu chạy thẳng');
  });

  test('có khối "đợi" phía sau thì không nhắc', async () => {
    const h = setup('robot.turnLeft(50);\nrobot.wait(0.5);\nrobot.stop();\n');
    h.runner.start();
    await h.scheduler.run(100);
    expect(h.runner.getStatus()).toBe('finished');
    expect(h.robot.getState().heading).toBeGreaterThan(0);
    expect(h.warnings).toEqual([]);
  });

  test('kiểu tránh vật cản: lệnh bị thay ở vài vòng lặp nhưng vẫn có lúc được chạy — không nhắc', async () => {
    const code =
      'var i = 0;\nwhile (i < 20) {\n robot.forwardOn(50);\n if (i >= 10) {\n  robot.turnLeft(50);\n }\n' +
      ' robot.tick();\n i = i + 1;\n}\nrobot.stop();\n';
    const h = setup(code);
    h.runner.start();
    await h.scheduler.run(100);
    expect(h.runner.getStatus()).toBe('finished');
    expect(h.warnings).toEqual([]);
  });

  test('vòng lặp mãi: bấm dừng thì nhắc lệnh không bao giờ được chạy', async () => {
    const h = setup('while (true) {\n robot.turnLeft(50);\n robot.forwardOn(50);\n robot.tick();\n}\n');
    h.runner.start();
    await h.scheduler.run(30);
    h.runner.stop();

    expect(h.warnings).toHaveLength(1);
    expect(h.warnings[0]).toContain('bắt đầu rẽ trái');
  });
});

describe('tất định: cùng chương trình, cùng kết quả', () => {
  const PROGRAM =
    'robot.forward(60, 1.3);\nrobot.turnLeftFor(50, 0.45);\nrobot.forwardOn(40);\nrobot.wait(0.7);\n' +
    'robot.turnRight(30);\nrobot.wait(0.5);\nrobot.drive(20, 70);\nrobot.wait(0.35);\nrobot.stop();\n';

  async function finalState(speed: 'slow' | 'normal' | 'fast', hz: number) {
    const robot = new SimRobot();
    const scheduler = new ManualScheduler();
    scheduler.frameMs = 1000 / hz;
    const runner = new ProgramRunner({ robot, code: PROGRAM, speed, scheduler });
    runner.start();
    await scheduler.run(5000);
    expect(runner.getStatus()).toBe('finished');
    return robot.getState();
  }

  test('chạy chậm, vừa, nhanh và màn 60Hz, 144Hz đều ra đúng một vị trí cuối', async () => {
    const reference = await finalState('normal', 60);
    for (const [speed, hz] of [
      ['slow', 60],
      ['fast', 60],
      ['normal', 144],
      ['fast', 144],
    ] as const) {
      const s = await finalState(speed, hz);
      expect(s.x, `${speed} ${hz}Hz`).toBeCloseTo(reference.x, 9);
      expect(s.z, `${speed} ${hz}Hz`).toBeCloseTo(reference.z, 9);
      expect(s.heading, `${speed} ${hz}Hz`).toBeCloseTo(reference.heading, 9);
    }
  });

  test('"đi thẳng 1 giây" đi đúng 1 giây, không thừa bước nào kể cả ở tốc độ nhanh', async () => {
    const robot = new SimRobot();
    const scheduler = new ManualScheduler();
    scheduler.frameMs = 1000 / 60;
    const runner = new ProgramRunner({ robot, code: 'robot.forward(100, 1);\n', speed: 'fast', scheduler });
    runner.start();
    await scheduler.run(100);
    // tốc độ 100 = 0.3 m/s, đúng 1 giây
    expect(robot.getState().x).toBeCloseTo(0.3, 9);
  });
});

describe('khối theo quãng đường và góc', () => {
  async function runProgram(code: string, speed: 'slow' | 'normal' | 'fast' = 'normal') {
    const robot = new SimRobot();
    const scheduler = new ManualScheduler();
    scheduler.frameMs = 1000 / 60;
    const runner = new ProgramRunner({ robot, code, speed, scheduler });
    runner.start();
    await scheduler.run(5000);
    expect(runner.getStatus()).toBe('finished');
    return robot.getState();
  }

  test('"đi thẳng 20 cm" đi đúng 20 cm, ở tốc độ nào cũng vậy', async () => {
    for (const speed of [50, 37, 100]) {
      const s = await runProgram(`robot.forwardCm(${speed}, 20);\n`);
      expect(s.x, `tốc độ ${speed}`).toBeCloseTo(0.2, 9);
      expect(s.z).toBeCloseTo(0, 9);
      expect(s.left, 'phải tự dừng').toBe(0);
    }
  });

  test('"đi lùi 15 cm" lùi đúng 15 cm', async () => {
    const s = await runProgram('robot.backwardCm(50, 15);\n');
    expect(s.x).toBeCloseTo(-0.15, 9);
  });

  test('"quay trái 90 độ" quay đúng một góc vuông, không xê dịch', async () => {
    const s = await runProgram('robot.turnLeftDeg(50, 90);\n');
    expect(s.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.hypot(s.x, s.z)).toBeLessThan(1e-9);
  });

  test('"quay phải 45 độ" ra góc âm', async () => {
    const s = await runProgram('robot.turnRightDeg(80, 45);\n');
    expect(s.heading).toBeCloseTo(-Math.PI / 4, 9);
  });

  test('đi hình vuông 30 cm thì quay về đúng chỗ xuất phát, ở cả ba tốc độ chạy', async () => {
    const square =
      'for (var i = 0; i < 4; i++) {\n robot.forwardCm(50, 30);\n robot.turnLeftDeg(50, 90);\n}\n';
    for (const speed of ['slow', 'normal', 'fast'] as const) {
      const s = await runProgram(square, speed);
      expect(Math.hypot(s.x, s.z), speed).toBeLessThan(1e-9);
      expect(s.heading, speed).toBeCloseTo(2 * Math.PI, 9);
    }
  });

  test('lệnh có thời gian lẻ (không chia hết bước 1/60 s) cũng dừng đúng lúc', async () => {
    const s = await runProgram('robot.forward(50, 0.3333);\n');
    expect(s.x).toBeCloseTo(0.15 * 0.3333, 9);
  });
});
