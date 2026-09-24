import * as Blockly from 'blockly/core';
import { INO_BLOCKS } from '../registry';
import type { Args } from '../types';

/**
 * Bộ sinh mã C++ (framework Arduino).
 * Blockly có sẵn bộ sinh JavaScript nhưng không có C++, nên phần này tự viết —
 * gồm các khối riêng của INO và các khối dùng lại của Blockly.
 */
export const cppGenerator = new Blockly.Generator('Cpp');

/** Thứ tự ưu tiên toán tử, để biết khi nào phải thêm ngoặc */
const Order = {
  ATOMIC: 0,
  UNARY: 2,
  MULTIPLICATIVE: 3,
  ADDITIVE: 4,
  RELATIONAL: 6,
  EQUALITY: 7,
  LOGICAL_AND: 11,
  LOGICAL_OR: 12,
  NONE: 99,
} as const;

cppGenerator.INDENT = '  ';

cppGenerator.addReservedWords(
  'setup,loop,ino,int,float,bool,char,void,while,for,if,else,return,break,continue,' +
    'true,false,delay,map,constrain,abs,sqrt,pow,random,Serial,String,HIGH,LOW',
);

/** Hàm do học sinh tự định nghĩa, gom lại để in phía trên setup() */
const functionDefs = new Map<string, string>();

/**
 * Blockly yêu cầu mỗi bộ sinh mã tự dựng bảng tên biến trong init().
 * Thiếu bước này thì getVariableName() không chạy được.
 */
cppGenerator.init = function (workspace) {
  functionDefs.clear();

  if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
  else this.nameDB_.reset();

  this.nameDB_.setVariableMap(workspace.getVariableMap());
  this.nameDB_.populateVariables(workspace);
  this.nameDB_.populateProcedures(workspace);
};

/* ------------------------ Khối riêng của INO ------------------------- */

for (const spec of INO_BLOCKS) {
  cppGenerator.forBlock[spec.type] = function (block, generator) {
    const args: Args = {};

    for (const arg of spec.args) {
      if (arg.kind === 'input') {
        args[arg.name] = generator.valueToCode(block, arg.name, Order.NONE) || '';
      } else {
        args[arg.name] = String(block.getFieldValue(arg.name) ?? '');
      }
    }

    for (const body of spec.bodies ?? []) {
      args[body.name] = generator.statementToCode(block, body.name);
    }

    const code = spec.toCpp(args);
    return spec.shape === 'number' || spec.shape === 'boolean' ? [code, Order.ATOMIC] : code;
  };
}

/* --------------------- Khối dùng lại của Blockly --------------------- */

cppGenerator.forBlock['math_number'] = (block) => {
  const n = Number(block.getFieldValue('NUM'));
  return [String(n), Order.ATOMIC];
};

cppGenerator.forBlock['math_arithmetic'] = (block, generator) => {
  const ops: Record<string, [string, number]> = {
    ADD: [' + ', Order.ADDITIVE],
    MINUS: [' - ', Order.ADDITIVE],
    MULTIPLY: [' * ', Order.MULTIPLICATIVE],
    DIVIDE: [' / ', Order.MULTIPLICATIVE],
    POWER: ['', Order.NONE],
  };
  const key = block.getFieldValue('OP') as keyof typeof ops;
  const [op, order] = ops[key] ?? ops.ADD!;
  const a = generator.valueToCode(block, 'A', order) || '0';
  const b = generator.valueToCode(block, 'B', order) || '0';
  if (key === 'POWER') return [`pow(${a}, ${b})`, Order.ATOMIC];
  return [`${a}${op}${b}`, order];
};

cppGenerator.forBlock['math_single'] = (block, generator) => {
  const op = block.getFieldValue('OP') as string;
  const arg = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  const fns: Record<string, string> = {
    ROOT: `sqrt(${arg})`,
    ABS: `abs(${arg})`,
    NEG: `-(${arg})`,
    LN: `log(${arg})`,
    LOG10: `log10(${arg})`,
    EXP: `exp(${arg})`,
    POW10: `pow(10, ${arg})`,
  };
  return [fns[op] ?? arg, Order.ATOMIC];
};

cppGenerator.forBlock['math_round'] = (block, generator) => {
  const op = block.getFieldValue('OP') as string;
  const arg = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  const fns: Record<string, string> = {
    ROUND: `round(${arg})`,
    ROUNDUP: `ceil(${arg})`,
    ROUNDDOWN: `floor(${arg})`,
  };
  return [fns[op] ?? `round(${arg})`, Order.ATOMIC];
};

cppGenerator.forBlock['math_modulo'] = (block, generator) => {
  const a = generator.valueToCode(block, 'DIVIDEND', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'DIVISOR', Order.NONE) || '1';
  // Ép sang số nguyên vì phép chia lấy dư của C++ không nhận số thực
  return [`((long)(${a}) % (long)(${b}))`, Order.ATOMIC];
};

cppGenerator.forBlock['math_constrain'] = (block, generator) => {
  const v = generator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  const low = generator.valueToCode(block, 'LOW', Order.NONE) || '0';
  const high = generator.valueToCode(block, 'HIGH', Order.NONE) || '0';
  return [`constrain(${v}, ${low}, ${high})`, Order.ATOMIC];
};

cppGenerator.forBlock['math_random_int'] = (block, generator) => {
  const from = generator.valueToCode(block, 'FROM', Order.NONE) || '1';
  const to = generator.valueToCode(block, 'TO', Order.NONE) || '10';
  return [`random(${from}, (${to}) + 1)`, Order.ATOMIC];
};

cppGenerator.forBlock['logic_boolean'] = (block) => [
  block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false',
  Order.ATOMIC,
];

cppGenerator.forBlock['logic_compare'] = (block, generator) => {
  const ops: Record<string, string> = {
    EQ: ' == ',
    NEQ: ' != ',
    LT: ' < ',
    LTE: ' <= ',
    GT: ' > ',
    GTE: ' >= ',
  };
  const op = ops[block.getFieldValue('OP') as string] ?? ' == ';
  const order = op.includes('=') && !op.includes('<') && !op.includes('>') ? Order.EQUALITY : Order.RELATIONAL;
  const a = generator.valueToCode(block, 'A', order) || '0';
  const b = generator.valueToCode(block, 'B', order) || '0';
  return [`${a}${op}${b}`, order];
};

cppGenerator.forBlock['logic_operation'] = (block, generator) => {
  const and = block.getFieldValue('OP') === 'AND';
  const op = and ? ' && ' : ' || ';
  const order = and ? Order.LOGICAL_AND : Order.LOGICAL_OR;
  const a = generator.valueToCode(block, 'A', order) || 'false';
  const b = generator.valueToCode(block, 'B', order) || 'false';
  return [`${a}${op}${b}`, order];
};

cppGenerator.forBlock['logic_negate'] = (block, generator) => {
  const v = generator.valueToCode(block, 'BOOL', Order.UNARY) || 'false';
  return [`!(${v})`, Order.UNARY];
};

cppGenerator.forBlock['controls_if'] = (block, generator) => {
  let n = 0;
  let code = '';

  do {
    const cond = generator.valueToCode(block, `IF${n}`, Order.NONE) || 'false';
    const body = generator.statementToCode(block, `DO${n}`);
    code += `${n === 0 ? '' : ' else '}if (${cond}) {\n${body}}`;
    n += 1;
  } while (block.getInput(`IF${n}`));

  if (block.getInput('ELSE')) {
    code += ` else {\n${generator.statementToCode(block, 'ELSE')}}`;
  }

  return `${code}\n`;
};

cppGenerator.forBlock['text'] = (block) => {
  const raw = String(block.getFieldValue('TEXT') ?? '');
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [`"${escaped}"`, Order.ATOMIC];
};

/* ----------------------- Hàm do học sinh định nghĩa ---------------------- */

cppGenerator.forBlock['procedures_defnoreturn'] = function (block, generator) {
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const params = ((block as unknown as { getVars?: () => string[] }).getVars?.() ?? []).map(
    (v) => `int ${generator.getVariableName(v)}`,
  );
  const body = generator.statementToCode(block, 'STACK');

  functionDefs.set(name, `void ${name}(${params.join(', ')}) {\n${body}}\n`);
  return null;
};

cppGenerator.forBlock['procedures_callnoreturn'] = function (block, generator) {
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const args: string[] = [];
  for (let i = 0; block.getInput(`ARG${i}`); i++) {
    args.push(generator.valueToCode(block, `ARG${i}`, Order.NONE) || '0');
  }
  return `${name}(${args.join(', ')});\n`;
};

cppGenerator.forBlock['variables_get'] = (block, generator) =>
  [generator.getVariableName(block.getFieldValue('VAR')), Order.ATOMIC] as [string, number];

cppGenerator.forBlock['variables_set'] = (block, generator) => {
  const name = generator.getVariableName(block.getFieldValue('VAR'));
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  return `${name} = ${value};\n`;
};

/* --------------------------- Ghép cả chương trình --------------------------- */

/**
 * Nối mã của khối đứng ngay dưới vào.
 *
 * BẮT BUỘC phải tự viết: lớp Generator gốc của Blockly chỉ trả về mã của
 * chính khối đó và bỏ qua khối nối phía dưới. Thiếu hàm này thì một chồng
 * khối lệnh chỉ sinh ra mã của khối đầu tiên.
 */
cppGenerator.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock();
  if (next && !thisOnly) return code + this.blockToCode(next);
  return code;
};

const indent = (code: string) =>
  code
    .split('\n')
    .map((line) => (line.trim() ? `  ${line}` : ''))
    .join('\n');

/**
 * Sinh phần thân chương trình.
 *
 * Không dùng workspaceToCode vì hàm đó gom cả những khối GIÁ TRỊ bị bỏ rơi
 * trên canvas (khối cảm biến, khối biến chưa cắm vào đâu) và in chúng ra
 * thành một dòng trơ trọi — mã đó không biên dịch được. Học sinh rất hay để
 * khối thừa nằm đấy, nên phải bỏ qua chúng.
 */
function generateBody(workspace: Blockly.Workspace): string {
  cppGenerator.init(workspace);

  const code = workspace
    .getTopBlocks(true)
    .filter((block) => !block.outputConnection)
    .map((block) => {
      const out = cppGenerator.blockToCode(block);
      return typeof out === 'string' ? out : out[0];
    })
    .join('');

  return cppGenerator.finish(code);
}

/** Sinh mã C++ hoàn chỉnh, đã có khung setup()/loop() của Arduino */
export function generateCpp(workspace: Blockly.Workspace): string {
  const body = generateBody(workspace).trimEnd();

  const variables = Blockly.Variables.allUsedVarModels(workspace)
    .map((v) => `int ${cppGenerator.getVariableName(v.getId())} = 0;`)
    .join('\n');

  const functions = [...functionDefs.values()].join('\n');

  // Chỉ mở Cổng Serial khi chương trình thật sự có lệnh in ra
  const usesSerial = body.includes('Serial.') || functions.includes('Serial.');

  return [
    '#include <INORobot.h>',
    '',
    'INORobot ino;',
    variables ? `\n${variables}` : '',
    functions ? `\n${functions}` : '',
    '',
    'void setup() {',
    '  ino.begin();',
    '  ino.calibrateSensors();',
    usesSerial ? '  Serial.begin(9600);' : '',
    '',
    indent(body) || '  // Kéo khối lệnh vào vùng lập trình để sinh mã',
    '}',
    '',
    'void loop() {',
    '  // Chương trình chạy một lần trong setup()',
    '}',
    '',
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n');
}
