import { describe, expect, test } from 'vitest';
import {
  countBlocks,
  createProjectSchema,
  unwrapWorkspace,
  updateProjectSchema,
  wrapWorkspace,
  WORKSPACE_VERSION,
} from './index';

describe('phiên bản nội dung khối lệnh', () => {
  const blockly = { blocks: { languageVersion: 0, blocks: [{ type: 'ino_stop' }] } };

  test('bọc rồi mở ra phải nguyên vẹn', () => {
    const stored = wrapWorkspace(blockly);
    expect(stored.version).toBe(WORKSPACE_VERSION);
    expect(unwrapWorkspace(stored)).toEqual(blockly);
  });

  test('bài làm lưu TRƯỚC khi có phiên bản vẫn đọc được', () => {
    // dữ liệu cũ: lưu thẳng nội dung Blockly, không có trường version
    expect(unwrapWorkspace(blockly)).toEqual(blockly);
    expect(countBlocks(blockly)).toBe(1);
  });

  test('đếm khối chạy đúng trên cả hai định dạng', () => {
    expect(countBlocks(wrapWorkspace(blockly))).toBe(1);
    expect(countBlocks(blockly)).toBe(1);
  });
});

describe('countBlocks', () => {
  test('workspace rỗng hoặc dữ liệu hỏng thì trả về 0', () => {
    expect(countBlocks(null)).toBe(0);
    expect(countBlocks({})).toBe(0);
    expect(countBlocks({ blocks: {} })).toBe(0);
    expect(countBlocks({ blocks: { blocks: [] } })).toBe(0);
    expect(countBlocks('không phải JSON hợp lệ')).toBe(0);
  });

  test('đếm cả khối nối phía dưới', () => {
    const ws = {
      blocks: {
        blocks: [{ type: 'a', next: { block: { type: 'b', next: { block: { type: 'c' } } } } }],
      },
    };
    expect(countBlocks(ws)).toBe(3);
  });

  test('đếm cả khối nằm trong ô lệnh và ô giá trị', () => {
    const ws = {
      blocks: {
        blocks: [
          {
            type: 'ino_if_else',
            inputs: {
              COND: { block: { type: 'ino_line_sensor' } },
              DO: { block: { type: 'ino_turn_left' } },
            },
          },
        ],
      },
    };
    expect(countBlocks(ws)).toBe(3);
  });

  test('đếm đúng cấu trúc lồng nhiều tầng', () => {
    // lặp mãi > nếu–thì > (cảm biến + rẽ trái), và một khối nối phía dưới
    const ws = {
      blocks: {
        blocks: [
          {
            type: 'ino_forever',
            inputs: {
              BODY: {
                block: {
                  type: 'ino_if_else',
                  inputs: {
                    COND: { block: { type: 'ino_line_sensor' } },
                    DO: { block: { type: 'ino_turn_left' } },
                  },
                },
              },
            },
            next: { block: { type: 'ino_stop' } },
          },
        ],
      },
    };
    expect(countBlocks(ws)).toBe(5);
  });

  test('đếm nhiều chồng khối rời nhau', () => {
    const ws = { blocks: { blocks: [{ type: 'a' }, { type: 'b' }, { type: 'c' }] } };
    expect(countBlocks(ws)).toBe(3);
  });
});

describe('schema kiểm tra dữ liệu', () => {
  test('tên bài làm không được rỗng và không quá 80 ký tự', () => {
    expect(createProjectSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: 'Robot dò line' }).success).toBe(true);
  });

  test('cập nhật rỗng bị từ chối', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ name: 'Tên mới' }).success).toBe(true);
  });
});
