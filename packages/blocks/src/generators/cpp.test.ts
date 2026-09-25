import { describe, expect, test, beforeEach } from 'vitest';
import * as Blockly from 'blockly/core';
import * as Vi from 'blockly/msg/vi';

import { registerInoBlocks } from '../blockly-defs';
import { INO_BLOCKS } from '../registry';
import { generateCpp } from './cpp';

// Nạp đúng bộ chữ như bản chạy thật — thiếu nó thì các khối tiêu chuẩn
// của Blockly (biến số, nếu–thì…) không dựng được
Blockly.setLocale(Vi as unknown as Record<string, string>);
registerInoBlocks();

let ws: Blockly.Workspace;

/** Tạo khối trên workspace không có giao diện — đủ để sinh mã */
function mk(type: string, fields: Record<string, string | number> = {}) {
  const block = ws.newBlock(type);
  for (const [name, value] of Object.entries(fields)) block.setFieldValue(String(value), name);
  return block;
}

/** Nối khối con vào một ô của khối cha */
function into(parent: Blockly.Block, child: Blockly.Block, input: string) {
  const connection = parent.getInput(input)?.connection;
  if (!connection) throw new Error(`Khối ${parent.type} không có ô "${input}"`);
  connection.connect(child.previousConnection ?? child.outputConnection!);
}

/** Nối khối vào ngay dưới khối khác */
function below(above: Blockly.Block, next: Blockly.Block) {
  above.nextConnection!.connect(next.previousConnection!);
}

beforeEach(() => {
  ws = new Blockly.Workspace();
});

/* ------------------------------------------------------------------ *
 * Ba lỗi đã từng mắc ở M1 — mỗi lỗi một ca chặn tái phát
 * ------------------------------------------------------------------ */

describe('ba lỗi đã từng mắc', () => {
  test('chồng khối liên tiếp phải sinh đủ mã của TẤT CẢ các khối', () => {
    // Lỗi cũ: lớp Generator gốc của Blockly bỏ qua khối nối phía dưới,
    // nên một chồng 4 lệnh chỉ sinh ra lệnh đầu tiên.
    const a = mk('ino_forward', { SPEED: 11, SECONDS: 1 });
    const b = mk('ino_turn_right', { SPEED: 22 });
    const c = mk('ino_wait', { SECONDS: 3 });
    const d = mk('ino_backward_on', { SPEED: 44 });
    below(a, b);
    below(b, c);
    below(c, d);

    const code = generateCpp(ws);
    expect(code).toContain('ino.driveForward(11)');
    expect(code).toContain('ino.turnRight(22)');
    expect(code).toContain('delay(3 * 1000)');
    expect(code).toContain('ino.driveBackward(44)');
  });

  test('chương trình có biến phải sinh được khai báo, không văng lỗi', () => {
    // Lỗi cũ: bộ sinh mã chưa dựng bảng tên biến trong init(),
    // nên getVariableName() ném lỗi ngay khi dùng khối biến.
    const variable = ws.getVariableMap().createVariable('tocDo');

    const set = mk('variables_set');
    set.setFieldValue(variable.getId(), 'VAR');
    into(set, mk('math_number', { NUM: 75 }), 'VALUE');

    const code = generateCpp(ws);
    expect(code).toContain('int tocDo = 0;');
    expect(code).toContain('tocDo = 75;');
  });

  test('khối giá trị bị bỏ rơi KHÔNG được lọt vào mã', () => {
    // Lỗi cũ: workspaceToCode gom cả khối giá trị chưa cắm vào đâu,
    // in ra thành một dòng trơ trọi không biên dịch được.
    mk('ino_stop');
    mk('ino_distance'); // khối giá trị nằm lạc trên canvas

    const code = generateCpp(ws);
    expect(code).toContain('ino.stop();');

    const body = code.slice(code.indexOf('void setup()'), code.indexOf('void loop()'));
    // không được có dòng nào chỉ gọi hàm mà thiếu dấu chấm phẩy
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.endsWith('{') || t === '}') continue;
      expect(t.endsWith(';'), `dòng không hợp lệ: "${t}"`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Cấu trúc điều khiển
 * ------------------------------------------------------------------ */

describe('cấu trúc điều khiển', () => {
  test('phần thân vòng lặp nằm TRONG vòng lặp, không rơi ra ngoài', () => {
    const loop = mk('ino_forever');
    into(loop, mk('ino_turn_left', { SPEED: 30 }), 'BODY');

    const code = generateCpp(ws);
    expect(code).toMatch(/while \(true\) \{[^}]*ino\.turnLeft\(30\);[^}]*\}/);
  });

  test('nếu–thì–ngược lại sinh đủ hai nhánh', () => {
    const branch = mk('ino_if_else');
    into(branch, mk('ino_line_sensor', { SIDE: 'LEFT' }), 'COND');
    into(branch, mk('ino_turn_left', { SPEED: 40 }), 'DO');
    into(branch, mk('ino_forward_on', { SPEED: 60 }), 'ELSE');

    const code = generateCpp(ws);
    expect(code).toMatch(/if \(ino\.readLine\(LINE_LEFT\)\) \{[\s\S]*\} else \{/);
    expect(code).toContain('ino.turnLeft(40)');
    expect(code).toContain('ino.driveForward(60)');
  });

  test('chỉ mở Cổng Serial khi chương trình thật sự có lệnh in', () => {
    mk('ino_stop');
    expect(generateCpp(ws)).not.toContain('Serial.begin');

    const ws2 = new Blockly.Workspace();
    const print = ws2.newBlock('ino_print');
    const text = ws2.newBlock('text');
    text.setFieldValue('xin chao', 'TEXT');
    print.getInput('VALUE')!.connection!.connect(text.outputConnection!);
    expect(generateCpp(ws2)).toContain('Serial.begin(9600)');
  });
});

/* ------------------------------------------------------------------ *
 * Ca quan trọng nhất: mọi khối đều sinh được CẢ HAI bản mã
 * ------------------------------------------------------------------ */

describe('mọi khối lệnh sinh được cả hai bản mã', () => {
  /** Giá trị giả cho từng tham số, đủ để gọi hai hàm sinh mã */
  const fakeArgs = (block: (typeof INO_BLOCKS)[number]) =>
    Object.fromEntries([
      ...block.args.map((a) => [a.name, a.kind === 'dropdown' ? (a.options?.[0]?.[1] ?? 'X') : '7']),
      ...(block.bodies ?? []).map((b) => [b.name, '  /* thân */\n']),
    ]);

  test.each(INO_BLOCKS.map((b) => [b.type, b] as const))('%s', (_type, block) => {
    const args = fakeArgs(block);

    const js = block.toJS(args);
    const cpp = block.toCpp(args);

    // Khối mũ cố tình không sinh mã; các khối còn lại phải sinh ra gì đó
    if (block.shape !== 'hat') {
      expect(js.length, 'bản JavaScript rỗng').toBeGreaterThan(0);
      expect(cpp.length, 'bản C++ rỗng').toBeGreaterThan(0);
    }

    // Mọi tham số đã khai đều phải xuất hiện ở CẢ HAI bản mã.
    // Đây là thứ chặn chuyện mô phỏng và robot thật hiểu khác nhau về một khối.
    for (const arg of block.args) {
      const value = args[arg.name]!;
      expect(js, `bản JS thiếu tham số ${arg.name}`).toContain(value);
      expect(cpp, `bản C++ thiếu tham số ${arg.name}`).toContain(value);
    }

    // Khối có thân thì mã phần thân phải nằm trong mã sinh ra
    for (const body of block.bodies ?? []) {
      expect(js, `bản JS thiếu thân ${body.name}`).toContain(args[body.name]!);
      expect(cpp, `bản C++ thiếu thân ${body.name}`).toContain(args[body.name]!);
    }
  });
});
