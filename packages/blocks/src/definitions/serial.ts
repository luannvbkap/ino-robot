import type { BlockSpec } from '../types';

/**
 * Khối hiển thị / gỡ lỗi.
 * Trên robot thật in ra Cổng Serial; trong mô phỏng in ra bảng thông báo.
 * Không phụ thuộc phần cứng nào nên dùng được với mọi mạch.
 */
export const SERIAL_BLOCKS: BlockSpec[] = [
  {
    type: 'ino_print',
    category: 'serial',
    message: 'in ra %1',
    args: [{ name: 'VALUE', kind: 'input' }],
    shape: 'statement',
    tooltip: 'In một giá trị ra màn hình để xem chương trình đang chạy tới đâu',
    toJS: (a) => `robot.print(${a.VALUE || `''`});\n`,
    toCpp: (a) => `Serial.println(${a.VALUE || '""'});\n`,
  },
  {
    type: 'ino_print_labeled',
    category: 'serial',
    message: 'in ra %1 bằng %2',
    args: [
      { name: 'LABEL', kind: 'input' },
      { name: 'VALUE', kind: 'input' },
    ],
    shape: 'statement',
    tooltip: 'In kèm tên cho dễ đọc. Ví dụ: in ra "khoảng cách" bằng <khoảng cách phía trước>',
    toJS: (a) => `robot.print(${a.LABEL || `''`} + ': ' + ${a.VALUE || `''`});\n`,
    toCpp: (a) =>
      `Serial.print(${a.LABEL || '""'});\nSerial.print(": ");\nSerial.println(${a.VALUE || '""'});\n`,
  },
];
