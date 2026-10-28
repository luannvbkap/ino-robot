import type { BlockSpec } from '../types';

/**
 * Khối chuyển động — điều khiển hai động cơ bánh xe.
 *
 * Thứ tự ở đây là thứ tự trong ngăn kéo:
 * 1. Theo QUÃNG ĐƯỜNG / GÓC ("đi thẳng 20 cm", "quay trái 90 độ") — gần với
 *    cách học sinh nghĩ nhất, nên đứng đầu.
 * 2. Theo THỜI GIAN ("… trong 1 giây").
 * 3. LIÊN TỤC ("bắt đầu …") — dùng cho vòng lặp đọc cảm biến như dò line.
 *
 * Đổi `message` không ảnh hưởng bài đã lưu; đổi `type` thì có — đừng đổi.
 */
export const MOTION_BLOCKS: BlockSpec[] = [
  /* ------------- Theo quãng đường / góc: robot tự tính thời gian chạy ------------- */
  {
    type: 'ino_forward_cm',
    category: 'motion',
    message: 'đi thẳng %1 cm với tốc độ %2',
    args: [
      { name: 'CM', kind: 'number', value: 20, min: 0, max: 500 },
      { name: 'SPEED', kind: 'number', value: 50, min: 1, max: 100 },
    ],
    shape: 'statement',
    tooltip:
      'Robot đi thẳng đúng quãng đường đã chọn rồi dừng. Trên robot thật, quãng đường được ' +
      'ước lượng theo tốc độ nên có thể lệch một chút tuỳ pin và mặt sàn.',
    toJS: (a) => `robot.forwardCm(${a.SPEED}, ${a.CM});\n`,
    toCpp: (a) => `ino.driveForwardCm(${a.SPEED}, ${a.CM});\n`,
  },
  {
    type: 'ino_backward_cm',
    category: 'motion',
    message: 'đi lùi %1 cm với tốc độ %2',
    args: [
      { name: 'CM', kind: 'number', value: 20, min: 0, max: 500 },
      { name: 'SPEED', kind: 'number', value: 50, min: 1, max: 100 },
    ],
    shape: 'statement',
    tooltip: 'Robot lùi đúng quãng đường đã chọn rồi dừng',
    toJS: (a) => `robot.backwardCm(${a.SPEED}, ${a.CM});\n`,
    toCpp: (a) => `ino.driveBackwardCm(${a.SPEED}, ${a.CM});\n`,
  },
  {
    type: 'ino_turn_left_deg',
    category: 'motion',
    message: 'quay trái %1 độ với tốc độ %2',
    args: [
      { name: 'DEGREES', kind: 'number', value: 90, min: 0, max: 3600 },
      { name: 'SPEED', kind: 'number', value: 50, min: 1, max: 100 },
    ],
    shape: 'statement',
    tooltip:
      'Robot quay tại chỗ sang trái đúng góc đã chọn rồi dừng. 90 độ là một góc vuông, ' +
      '360 độ là một vòng. Trên robot thật, góc được ước lượng nên có thể lệch vài độ.',
    toJS: (a) => `robot.turnLeftDeg(${a.SPEED}, ${a.DEGREES});\n`,
    toCpp: (a) => `ino.turnLeftDeg(${a.SPEED}, ${a.DEGREES});\n`,
  },
  {
    type: 'ino_turn_right_deg',
    category: 'motion',
    message: 'quay phải %1 độ với tốc độ %2',
    args: [
      { name: 'DEGREES', kind: 'number', value: 90, min: 0, max: 3600 },
      { name: 'SPEED', kind: 'number', value: 50, min: 1, max: 100 },
    ],
    shape: 'statement',
    tooltip: 'Robot quay tại chỗ sang phải đúng góc đã chọn rồi dừng. 90 độ là một góc vuông.',
    toJS: (a) => `robot.turnRightDeg(${a.SPEED}, ${a.DEGREES});\n`,
    toCpp: (a) => `ino.turnRightDeg(${a.SPEED}, ${a.DEGREES});\n`,
  },

  /* ------------------ Có thời gian: chạy xong mới sang lệnh sau ------------------ */
  {
    type: 'ino_forward',
    category: 'motion',
    message: 'đi thẳng với tốc độ %1 trong %2 giây',
    args: [
      { name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 },
      { name: 'SECONDS', kind: 'number', value: 1, min: 0, max: 60 },
    ],
    shape: 'statement',
    tooltip: 'Robot đi thẳng về phía trước trong khoảng thời gian đã chọn',
    toJS: (a) => `robot.forward(${a.SPEED}, ${a.SECONDS});\n`,
    toCpp: (a) => `ino.driveForward(${a.SPEED});\ndelay(${a.SECONDS} * 1000);\nino.stop();\n`,
  },
  {
    type: 'ino_backward',
    category: 'motion',
    message: 'đi lùi với tốc độ %1 trong %2 giây',
    args: [
      { name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 },
      { name: 'SECONDS', kind: 'number', value: 1, min: 0, max: 60 },
    ],
    shape: 'statement',
    tooltip: 'Robot lùi lại phía sau',
    toJS: (a) => `robot.backward(${a.SPEED}, ${a.SECONDS});\n`,
    toCpp: (a) => `ino.driveBackward(${a.SPEED});\ndelay(${a.SECONDS} * 1000);\nino.stop();\n`,
  },
  {
    type: 'ino_turn_left_for',
    category: 'motion',
    message: 'rẽ trái với tốc độ %1 trong %2 giây',
    args: [
      { name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 },
      { name: 'SECONDS', kind: 'number', value: 1, min: 0, max: 60 },
    ],
    shape: 'statement',
    tooltip: 'Robot quay trái trong khoảng thời gian đã chọn rồi tự dừng',
    toJS: (a) => `robot.turnLeftFor(${a.SPEED}, ${a.SECONDS});\n`,
    toCpp: (a) => `ino.turnLeft(${a.SPEED});\ndelay(${a.SECONDS} * 1000);\nino.stop();\n`,
  },
  {
    type: 'ino_turn_right_for',
    category: 'motion',
    message: 'rẽ phải với tốc độ %1 trong %2 giây',
    args: [
      { name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 },
      { name: 'SECONDS', kind: 'number', value: 1, min: 0, max: 60 },
    ],
    shape: 'statement',
    tooltip: 'Robot quay phải trong khoảng thời gian đã chọn rồi tự dừng',
    toJS: (a) => `robot.turnRightFor(${a.SPEED}, ${a.SECONDS});\n`,
    toCpp: (a) => `ino.turnRight(${a.SPEED});\ndelay(${a.SECONDS} * 1000);\nino.stop();\n`,
  },

  /* ------------- Liên tục: bật động cơ rồi sang lệnh sau ngay, không chờ ------------- */
  {
    type: 'ino_forward_on',
    category: 'motion',
    message: 'bắt đầu chạy thẳng với tốc độ %1',
    args: [{ name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 }],
    shape: 'statement',
    tooltip:
      'Robot bắt đầu đi thẳng và cứ thế chạy cho tới khi gặp lệnh chuyển động khác. ' +
      'Dùng trong vòng lặp dò line. Muốn chạy một lúc rồi dừng, dùng khối "đi thẳng … trong … giây".',
    toJS: (a) => `robot.forwardOn(${a.SPEED});\n`,
    toCpp: (a) => `ino.driveForward(${a.SPEED});\n`,
  },
  {
    type: 'ino_backward_on',
    category: 'motion',
    message: 'bắt đầu chạy lùi với tốc độ %1',
    args: [{ name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 }],
    shape: 'statement',
    tooltip: 'Robot bắt đầu lùi và cứ thế chạy cho tới khi gặp lệnh chuyển động khác',
    toJS: (a) => `robot.backwardOn(${a.SPEED});\n`,
    toCpp: (a) => `ino.driveBackward(${a.SPEED});\n`,
  },
  {
    type: 'ino_turn_left',
    category: 'motion',
    message: 'bắt đầu rẽ trái với tốc độ %1',
    args: [{ name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 }],
    shape: 'statement',
    tooltip:
      'Robot bắt đầu quay trái và cứ thế quay cho tới khi gặp lệnh chuyển động khác. ' +
      'Muốn rẽ một góc, dùng khối "rẽ trái … trong … giây".',
    toJS: (a) => `robot.turnLeft(${a.SPEED});\n`,
    toCpp: (a) => `ino.turnLeft(${a.SPEED});\n`,
  },
  {
    type: 'ino_turn_right',
    category: 'motion',
    message: 'bắt đầu rẽ phải với tốc độ %1',
    args: [{ name: 'SPEED', kind: 'number', value: 50, min: 0, max: 100 }],
    shape: 'statement',
    tooltip:
      'Robot bắt đầu quay phải và cứ thế quay cho tới khi gặp lệnh chuyển động khác. ' +
      'Muốn rẽ một góc, dùng khối "rẽ phải … trong … giây".',
    toJS: (a) => `robot.turnRight(${a.SPEED});\n`,
    toCpp: (a) => `ino.turnRight(${a.SPEED});\n`,
  },
  {
    type: 'ino_drive',
    category: 'motion',
    message: 'bắt đầu chạy động cơ trái %1 phải %2',
    args: [
      { name: 'LEFT', kind: 'number', value: 50, min: -100, max: 100 },
      { name: 'RIGHT', kind: 'number', value: 50, min: -100, max: 100 },
    ],
    shape: 'statement',
    tooltip: 'Đặt tốc độ riêng cho từng bánh, chạy cho tới khi gặp lệnh khác. Số âm là quay ngược.',
    toJS: (a) => `robot.drive(${a.LEFT}, ${a.RIGHT});\n`,
    toCpp: (a) => `ino.drive(${a.LEFT}, ${a.RIGHT});\n`,
  },
  {
    type: 'ino_stop',
    category: 'motion',
    message: 'dừng động cơ',
    args: [],
    shape: 'statement',
    tooltip: 'Dừng cả hai bánh xe',
    toJS: () => `robot.stop();\n`,
    toCpp: () => `ino.stop();\n`,
  },
];
