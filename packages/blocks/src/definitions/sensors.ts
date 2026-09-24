import type { BlockSpec } from '../types';

/** Khối cảm biến — đọc giá trị từ cảm biến dò line và cảm biến siêu âm */
export const SENSOR_BLOCKS: BlockSpec[] = [
  {
    type: 'ino_line_sensor',
    category: 'sensors',
    message: 'cảm biến line %1 gặp vạch',
    args: [
      {
        name: 'SIDE',
        kind: 'dropdown',
        options: [
          ['trái', 'LEFT'],
          ['phải', 'RIGHT'],
        ],
      },
    ],
    shape: 'boolean',
    tooltip: 'Đúng khi cảm biến đang nhìn thấy vạch đen dưới sàn',
    toJS: (a) => `robot.lineSensor('${a.SIDE}')`,
    toCpp: (a) => `ino.readLine(LINE_${a.SIDE})`,
  },
  {
    type: 'ino_distance',
    category: 'sensors',
    message: 'khoảng cách phía trước (cm)',
    args: [],
    shape: 'number',
    tooltip: 'Khoảng cách từ robot tới vật cản gần nhất phía trước, tính bằng xăng-ti-mét',
    toJS: () => `robot.distance()`,
    toCpp: () => `ino.readDistance()`,
  },
  {
    type: 'ino_obstacle_near',
    category: 'sensors',
    message: 'có vật cản gần hơn %1 cm',
    args: [{ name: 'CM', kind: 'number', value: 20, min: 1, max: 400 }],
    shape: 'boolean',
    tooltip: 'Đúng khi phía trước có vật cản nằm gần hơn khoảng cách đã chọn',
    toJS: (a) => `(robot.distance() < ${a.CM})`,
    toCpp: (a) => `(ino.readDistance() < ${a.CM})`,
  },
];
