import type { BlockSpec, CategoryId } from './types';
import { MOTION_BLOCKS } from './definitions/motion';
import { SENSOR_BLOCKS } from './definitions/sensors';
import { CONTROL_BLOCKS } from './definitions/control';
import { MATH_BLOCKS } from './definitions/math';
import { SERIAL_BLOCKS } from './definitions/serial';

/** Toàn bộ khối lệnh riêng của INO */
export const INO_BLOCKS: BlockSpec[] = [
  ...MOTION_BLOCKS,
  ...SENSOR_BLOCKS,
  ...CONTROL_BLOCKS,
  ...MATH_BLOCKS,
  ...SERIAL_BLOCKS,
];

export const BLOCK_BY_TYPE = new Map(INO_BLOCKS.map((b) => [b.type, b]));

/**
 * Khối dùng lại của Blockly.
 * Blockly đã dịch sẵn sang tiếng Việt nên không cần khai lại,
 * chỉ cần viết bộ sinh mã C++ cho chúng — xem generators/cpp.ts.
 */
export const BUILTIN_BLOCKS: Partial<Record<CategoryId, string[]>> = {
  control: ['controls_if', 'procedures_defnoreturn', 'procedures_callnoreturn'],
  logic: ['logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean'],
  math: [
    'math_number',
    'math_arithmetic',
    'math_single',
    'math_round',
    'math_modulo',
    'math_constrain',
    'math_random_int',
  ],
  serial: ['text'],
  variables: [],
};
