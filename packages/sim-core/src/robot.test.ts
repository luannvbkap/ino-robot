import { describe, expect, test } from 'vitest';
import { DEFAULT_SPEC, FIXED_DT, SimRobot, inoMap } from './index';

/** Chạy mô phỏng n bước, mặc định bước cố định */
function run(robot: SimRobot, steps: number, dt = FIXED_DT) {
  for (let i = 0; i < steps; i++) robot.step(dt);
}

/**
 * Nhường đủ lượt cho mọi Promise đang chờ hoàn tất.
 *
 * Một `await Promise.resolve()` chỉ nhường MỘT lượt, trong khi chuỗi
 * `forward → waitSeconds → setMotors → then` cần ba lượt. Khi chạy thật thì
 * mỗi khung hình là một macrotask nên mọi microtask tự được dọn hết — chỉ
 * bài test mới phải làm thủ công.
 */
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

/** Chạy mô phỏng cho tới khi lệnh đang chờ hoàn tất, có chặn vòng lặp vô hạn */
async function runUntil(robot: SimRobot, promise: Promise<void>, maxSteps = 1000) {
  let done = false;
  const finished = promise.then(() => {
    done = true;
  });

  for (let i = 0; i < maxSteps && !done; i++) {
    robot.step();
    await flush();
  }
  await finished;
}

describe('chuyển động vi sai', () => {
  test('hai bánh bằng nhau thì đi thẳng, không lệch', () => {
    const robot = new SimRobot();
    robot.drive(50, 50);
    run(robot, 60); // 1 giây mô phỏng

    const s = robot.getState();
    // tốc độ 50 = một nửa maxSpeed 0.3 m/s = 0.15 m/s, chạy 1 giây
    expect(s.x).toBeCloseTo(0.15, 3);
    expect(s.z).toBeCloseTo(0, 6);
    expect(s.heading).toBeCloseTo(0, 6);
  });

  test('hai bánh ngược chiều thì quay tại chỗ', () => {
    const robot = new SimRobot();
    robot.turnLeft(50);
    run(robot, 60);

    const s = robot.getState();
    expect(Math.hypot(s.x, s.z), 'không được rời khỏi chỗ').toBeLessThan(0.01);
    expect(Math.abs(s.heading), 'phải quay được một góc').toBeGreaterThan(0.5);
  });

  test('rẽ trái thì đi về phía -Z, khớp với bên trái robot trong Three.js', () => {
    // Bánh phải nhanh hơn bánh trái = rẽ trái
    const robot = new SimRobot();
    robot.drive(30, 60);
    run(robot, 60);

    const s = robot.getState();
    expect(s.heading, 'quay trái là góc dương').toBeGreaterThan(0);
    expect(s.z, 'bên trái robot là -Z').toBeLessThan(0);
    expect(s.x).toBeGreaterThan(0);
  });

  test('đi lùi cho toạ độ âm', () => {
    const robot = new SimRobot();
    robot.backwardOn(100);
    run(robot, 60);
    expect(robot.getState().x).toBeCloseTo(-DEFAULT_SPEC.maxSpeed, 3);
  });

  test('tốc độ bị giới hạn trong khoảng -100…100', () => {
    const robot = new SimRobot();
    robot.drive(500, -500);
    const s = robot.getState();
    expect(s.left).toBe(100);
    expect(s.right).toBe(-100);
  });
});

describe('kết quả không phụ thuộc tốc độ máy', () => {
  test('chạy 60 bước ×1/60s và 120 bước ×1/120s cho cùng quãng đường', () => {
    const a = new SimRobot();
    a.drive(70, 70);
    run(a, 60, 1 / 60);

    const b = new SimRobot();
    b.drive(70, 70);
    run(b, 120, 1 / 120);

    expect(b.getState().x).toBeCloseTo(a.getState().x, 6);
    expect(b.getState().time).toBeCloseTo(a.getState().time, 6);
  });

  test('chạy lại cùng lệnh cho kết quả giống hệt', () => {
    const play = () => {
      const robot = new SimRobot();
      robot.drive(40, 80);
      run(robot, 180);
      return robot.getState();
    };
    expect(play()).toEqual(play());
  });
});

describe('lệnh có thời gian', () => {
  test('đi thẳng 2 giây rồi tự dừng', async () => {
    const robot = new SimRobot();
    await runUntil(robot, robot.forward(50, 2));

    const s = robot.getState();
    expect(s.time).toBeCloseTo(2, 2);
    expect(s.x).toBeCloseTo(0.3, 2); // 0.15 m/s × 2 giây
    expect(s.left, 'phải tự dừng sau khi hết giờ').toBe(0);
    expect(s.right).toBe(0);
  });

  test('đợi N giây trôi đúng N giây mô phỏng', async () => {
    const robot = new SimRobot();
    await runUntil(robot, robot.wait(1.5));
    expect(robot.getState().time).toBeCloseTo(1.5, 2);
  });

  test('tick nhường đúng một bước', async () => {
    const robot = new SimRobot();
    await runUntil(robot, robot.tick());
    expect(robot.getState().time).toBeCloseTo(FIXED_DT, 6);
  });

  test('đặt lại trạng thái giải phóng mọi lệnh đang chờ', async () => {
    const robot = new SimRobot();
    let done = false;
    robot.forward(50, 10).then(() => {
      done = true;
    });

    robot.reset();
    await flush();
    expect(done, 'lệnh đang chờ phải được giải phóng, không treo mãi').toBe(true);
    expect(robot.getState().time).toBe(0);
  });
});

describe('cảm biến ở mốc M2', () => {
  test('trả giá trị cố định và cảnh báo đúng một lần', () => {
    const warnings: string[] = [];
    const robot = new SimRobot({ onWarning: (t) => warnings.push(t) });

    expect(robot.lineSensor('LEFT')).toBe(false);
    expect(robot.distance()).toBe(100);
    robot.lineSensor('RIGHT');
    robot.distance();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('M4');
  });

  test('thay nguồn cảm biến thì không cảnh báo nữa', () => {
    const warnings: string[] = [];
    const robot = new SimRobot({
      onWarning: (t) => warnings.push(t),
      sensors: { lineSensor: () => true, distance: () => 42 },
    });

    expect(robot.lineSensor('LEFT')).toBe(true);
    expect(robot.distance()).toBe(42);
    expect(warnings).toHaveLength(0);
  });
});

describe('khối in ra', () => {
  test('chuyển giá trị sang chữ rồi gửi ra ngoài', () => {
    const lines: string[] = [];
    const robot = new SimRobot({ onPrint: (t) => lines.push(t) });

    robot.print('xin chào');
    robot.print(42);
    expect(lines).toEqual(['xin chào', '42']);
  });
});

describe('hàm ánh xạ', () => {
  test('đổi khoảng giá trị đúng', () => {
    expect(inoMap(0, 0, 1023, 0, 100)).toBe(0);
    expect(inoMap(1023, 0, 1023, 0, 100)).toBe(100);
    expect(inoMap(512, 0, 1024, 0, 100)).toBeCloseTo(50, 4);
  });

  test('khoảng nguồn bằng 0 thì không chia cho 0', () => {
    expect(inoMap(5, 10, 10, 0, 100)).toBe(0);
  });
});
