import * as Blockly from 'blockly/core';
// Bộ khối tiêu chuẩn (nếu–thì, so sánh, toán, biến số…).
// blockly/core KHÔNG kèm sẵn — thiếu dòng này là lỗi "Invalid block definition".
import 'blockly/blocks';
import { INO_BLOCKS } from './registry';
import { CATEGORY_COLOR, type BlockSpec } from './types';

/** Chuyển một BlockSpec sang định dạng JSON mà Blockly hiểu */
function toBlocklyJson(spec: BlockSpec) {
  const args = spec.args.map((a) => {
    if (a.kind === 'number') {
      return {
        type: 'field_number',
        name: a.name,
        value: a.value ?? 0,
        min: a.min,
        max: a.max,
      };
    }
    if (a.kind === 'dropdown') {
      return { type: 'field_dropdown', name: a.name, options: a.options ?? [] };
    }
    return { type: 'input_value', name: a.name, check: a.check };
  });

  const json: Record<string, unknown> = {
    type: spec.type,
    message0: spec.message,
    args0: args,
    colour: CATEGORY_COLOR[spec.category],
    tooltip: spec.tooltip,
    helpUrl: '',
  };

  // Ô chứa các lệnh con, ví dụ phần thân của "lặp mãi".
  // Khối nhiều thân (nếu–thì–ngược lại) thì mỗi thân là một dòng message tiếp theo.
  spec.bodies?.forEach((body, i) => {
    const n = i + 1;
    json[`message${n}`] = body.label ? `${body.label} %1` : '%1';
    json[`args${n}`] = [{ type: 'input_statement', name: body.name }];
  });

  switch (spec.shape) {
    case 'statement':
      json.previousStatement = null;
      json.nextStatement = null;
      break;
    case 'hat':
      json.nextStatement = null;
      break;
    case 'number':
      json.output = 'Number';
      break;
    case 'boolean':
      json.output = 'Boolean';
      break;
  }

  return json;
}

let registered = false;

/**
 * Khối "nếu … thực hiện" của Blockly mặc định mang màu nhóm Logic,
 * nhưng trong ngăn kéo của INO nó nằm ở nhóm Điều khiển. Đổi sang màu
 * nhóm Điều khiển để học sinh không thấy lệch màu giữa ngăn kéo và khối.
 */
function recolourBuiltins() {
  const ifBlock = Blockly.Blocks['controls_if'] as { init?: () => void } | undefined;
  if (!ifBlock?.init) return;

  const original = ifBlock.init;
  ifBlock.init = function (this: Blockly.Block) {
    original.call(this);
    this.setStyle('loop_blocks');
  };
}

/** Nạp toàn bộ khối lệnh của INO vào Blockly. Gọi một lần khi khởi động. */
export function registerInoBlocks() {
  if (registered) return;
  Blockly.common.defineBlocksWithJsonArray(INO_BLOCKS.map(toBlocklyJson));
  recolourBuiltins();
  registered = true;
}
