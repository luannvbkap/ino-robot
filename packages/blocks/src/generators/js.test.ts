import { describe, expect, test, beforeEach } from 'vitest';
import * as Blockly from 'blockly/core';
import * as Vi from 'blockly/msg/vi';

import { registerInoBlocks } from '../blockly-defs';
import { generateJs } from './js';

Blockly.setLocale(Vi as unknown as Record<string, string>);
registerInoBlocks();

let ws: Blockly.Workspace;

function mk(type: string, fields: Record<string, string | number> = {}) {
  const block = ws.newBlock(type);
  for (const [name, value] of Object.entries(fields)) block.setFieldValue(String(value), name);
  return block;
}

function into(parent: Blockly.Block, child: Blockly.Block, input: string) {
  parent.getInput(input)!.connection!.connect(child.previousConnection ?? child.outputConnection!);
}

function below(above: Blockly.Block, next: Blockly.Block) {
  above.nextConnection!.connect(next.previousConnection!);
}

beforeEach(() => {
  ws = new Blockly.Workspace();
});

/* ------------------------------------------------------------------ *
 * Mã sinh ra phải là ES5 thuần — JS-Interpreter không hiểu ES6
 * ------------------------------------------------------------------ */

describe('mã sinh ra phải là ES5 thuần', () => {
  test('không có await, let, const hay hàm mũi tên', () => {
    const loop = mk('ino_forever');
    const forward = mk('ino_forward', { SPEED: 50, SECONDS: 2 });
    into(loop, forward, 'BODY');
    below(forward, mk('ino_wait', { SECONDS: 1 }));

    const repeat = mk('ino_repeat', { TIMES: 5 });
    into(repeat, mk('ino_stop'), 'BODY');

    const code = generateJs(ws);

    expect(code, 'còn từ khoá await').not.toMatch(/\bawait\b/);
    expect(code, 'còn khai báo let').not.toMatch(/\blet\s+\w/);
    expect(code, 'còn khai báo const').not.toMatch(/\bconst\s+\w/);
    expect(code, 'còn hàm mũi tên').not.toMatch(/=>/);
  });

  test('vòng lặp dùng var chứ không phải let', () => {
    const repeat = mk('ino_repeat', { TIMES: 3 });
    into(repeat, mk('ino_stop'), 'BODY');
    expect(generateJs(ws)).toContain('for (var i = 0; i < 3; i++)');
  });
});

/* ------------------------------------------------------------------ *
 * Vòng lặp phải nhường lượt, nếu không robot sẽ không nhúc nhích
 * ------------------------------------------------------------------ */

describe('vòng lặp nhường lượt cho mô phỏng', () => {
  test('lặp mãi có robot.tick() ở cuối mỗi vòng', () => {
    const loop = mk('ino_forever');
    into(loop, mk('ino_forward_on', { SPEED: 50 }), 'BODY');

    const code = generateJs(ws);
    // Thiếu tick thì vòng lặp quay vô hạn mà thời gian mô phỏng đứng yên
    expect(code).toMatch(/while \(true\) \{[\s\S]*robot\.tick\(\);[\s\S]*\}/);
  });

  test('lặp cho đến khi cũng có tick', () => {
    const loop = mk('ino_repeat_until');
    into(loop, mk('ino_obstacle_near', { CM: 20 }), 'COND');
    into(loop, mk('ino_forward_on', { SPEED: 40 }), 'BODY');
    expect(generateJs(ws)).toContain('robot.tick();');
  });
});

/* ------------------------------------------------------------------ *
 * Tô sáng khối đang chạy
 * ------------------------------------------------------------------ */

describe('tô sáng khối đang chạy', () => {
  test('mỗi câu lệnh được chèn lệnh đánh dấu kèm mã khối', () => {
    const forward = mk('ino_forward', { SPEED: 50, SECONDS: 1 });
    const code = generateJs(ws);

    expect(code).toContain('highlightBlock(');
    expect(code, 'phải kèm đúng mã của khối').toContain(forward.id);
  });
});

/* ------------------------------------------------------------------ *
 * Ba lỗi của bản C++ — kiểm tra bản JS không mắc lại
 * ------------------------------------------------------------------ */

describe('ba lỗi của bản C++ không lặp lại ở bản JS', () => {
  test('chồng khối sinh đủ mã của tất cả các khối', () => {
    const a = mk('ino_forward', { SPEED: 11, SECONDS: 1 });
    const b = mk('ino_turn_right', { SPEED: 22 });
    const c = mk('ino_wait', { SECONDS: 3 });
    below(a, b);
    below(b, c);

    const code = generateJs(ws);
    expect(code).toContain('robot.forward(11, 1)');
    expect(code).toContain('robot.turnRight(22)');
    expect(code).toContain('robot.wait(3)');
  });

  test('chương trình có biến sinh được mã, không văng lỗi', () => {
    const variable = ws.getVariableMap().createVariable('tocDo');
    const set = mk('variables_set');
    set.setFieldValue(variable.getId(), 'VAR');
    into(set, mk('math_number', { NUM: 75 }), 'VALUE');

    const code = generateJs(ws);
    expect(code).toMatch(/tocDo\s*=\s*75/);
  });

  test('khối giá trị bỏ rơi không lọt vào mã', () => {
    mk('ino_stop');
    mk('ino_distance'); // nằm lạc trên canvas

    const code = generateJs(ws);
    expect(code).toContain('robot.stop();');
    expect(code.match(/robot\.distance\(\)/g) ?? []).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * Cấu trúc điều khiển
 * ------------------------------------------------------------------ */

describe('cấu trúc điều khiển', () => {
  test('nếu–thì–ngược lại sinh đủ hai nhánh', () => {
    const branch = mk('ino_if_else');
    into(branch, mk('ino_line_sensor', { SIDE: 'LEFT' }), 'COND');
    into(branch, mk('ino_turn_left', { SPEED: 40 }), 'DO');
    into(branch, mk('ino_forward_on', { SPEED: 60 }), 'ELSE');

    const code = generateJs(ws);
    expect(code).toMatch(/if \(robot\.lineSensor\('LEFT'\)\) \{[\s\S]*\} else \{/);
    expect(code).toContain('robot.turnLeft(40)');
    expect(code).toContain('robot.forwardOn(60)');
  });

  test('ánh xạ dùng hàm tiện ích riêng, không gắn vào robot', () => {
    const print = mk('ino_print');
    const map = mk('ino_map', { FROM_LOW: 0, FROM_HIGH: 400, TO_LOW: 0, TO_HIGH: 100 });
    into(map, mk('ino_distance'), 'VALUE');
    into(print, map, 'VALUE');

    const code = generateJs(ws);
    expect(code).toContain('inoMap(robot.distance(), 0, 400, 0, 100)');
    expect(code).not.toContain('robot.map(');
  });
});
