import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';

import { INO_BLOCKS } from '../registry';
import type { Args } from '../types';

/**
 * Bộ sinh mã JavaScript — thứ thật sự được chạy để mô phỏng robot.
 *
 * KHÔNG viết bộ sinh mới như bản C++. Blockly đã có sẵn bộ sinh JavaScript cho
 * toàn bộ khối tiêu chuẩn, và bộ đó đã xử lý đúng ba thứ mà bản C++ từng làm
 * sai: nối khối phía dưới, bảng tên biến, và thứ tự ưu tiên toán tử.
 * Việc ở đây chỉ là gắn thêm các khối riêng của INO vào bộ có sẵn.
 *
 * Mã sinh ra chạy trong JS-Interpreter nên phải là **ES5 thuần**:
 * không `await`, không `let`/`const`, không hàm mũi tên.
 * Các lệnh cần chờ (đi thẳng 2 giây) được đăng ký bằng createAsyncFunction —
 * nhìn từ trong mã thì như lệnh thường, nhưng trình thông dịch sẽ dừng lại
 * cho tới khi mô phỏng chạy xong.
 */

/** Tên hàm đánh dấu khối đang chạy, do trình chạy cung cấp */
export const HIGHLIGHT_FN = 'highlightBlock';

let registered = false;

export function registerJsGenerators() {
  if (registered) return;

  for (const spec of INO_BLOCKS) {
    javascriptGenerator.forBlock[spec.type] = function (block, generator) {
      const args: Args = {};

      for (const arg of spec.args) {
        args[arg.name] =
          arg.kind === 'input'
            ? generator.valueToCode(block, arg.name, Order.NONE) || ''
            : String(block.getFieldValue(arg.name) ?? '');
      }

      for (const body of spec.bodies ?? []) {
        args[body.name] = generator.statementToCode(block, body.name);
      }

      const code = spec.toJS(args);
      return spec.shape === 'number' || spec.shape === 'boolean'
        ? ([code, Order.ATOMIC] as [string, number])
        : code;
    };
  }

  // Chèn lệnh tô sáng trước mỗi câu lệnh — nhờ đó biết đang chạy tới khối nào
  javascriptGenerator.STATEMENT_PREFIX = `${HIGHLIGHT_FN}(%1);\n`;
  javascriptGenerator.addReservedWords(`${HIGHLIGHT_FN},robot,inoMap`);

  registered = true;
}

/**
 * Sinh mã JavaScript cho cả chương trình.
 *
 * Bỏ qua khối giá trị bị bỏ rơi trên canvas, giống bản C++ — chúng sinh ra
 * một dòng trơ trọi vô nghĩa.
 */
export function generateJs(workspace: Blockly.Workspace): string {
  registerJsGenerators();
  javascriptGenerator.init(workspace);

  const code = workspace
    .getTopBlocks(true)
    .filter((block) => !block.outputConnection)
    .map((block) => {
      const out = javascriptGenerator.blockToCode(block);
      return typeof out === 'string' ? out : out[0];
    })
    .join('');

  return javascriptGenerator.finish(code);
}
