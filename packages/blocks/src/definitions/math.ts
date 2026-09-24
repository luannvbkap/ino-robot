import type { BlockSpec } from '../types';

export const MATH_BLOCKS: BlockSpec[] = [
  {
    type: 'ino_map',
    category: 'math',
    message: 'ánh xạ %1 từ khoảng %2 – %3 sang khoảng %4 – %5',
    args: [
      { name: 'VALUE', kind: 'input', check: 'Number' },
      { name: 'FROM_LOW', kind: 'number', value: 0 },
      { name: 'FROM_HIGH', kind: 'number', value: 1023 },
      { name: 'TO_LOW', kind: 'number', value: 0 },
      { name: 'TO_HIGH', kind: 'number', value: 100 },
    ],
    shape: 'number',
    tooltip:
      'Đổi một giá trị từ khoảng này sang khoảng khác. Ví dụ đổi số đọc từ cảm biến (0–1023) thành phần trăm tốc độ (0–100).',
    toJS: (a) =>
      `robot.map(${a.VALUE || 0}, ${a.FROM_LOW}, ${a.FROM_HIGH}, ${a.TO_LOW}, ${a.TO_HIGH})`,
    toCpp: (a) => `map(${a.VALUE || 0}, ${a.FROM_LOW}, ${a.FROM_HIGH}, ${a.TO_LOW}, ${a.TO_HIGH})`,
  },
];
