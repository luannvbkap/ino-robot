import { INO_BLOCKS, BUILTIN_BLOCKS } from './registry';
import { CATEGORY_LABEL, type CategoryId } from './types';

export const CATEGORY_ORDER: CategoryId[] = [
  'motion',
  'sensors',
  'control',
  'logic',
  'math',
  'variables',
  'serial',
];

/**
 * Khối của nhóm nào thì nằm trong ngăn kéo của nhóm đó.
 * Kể cả khối mũ "khi bấm vào nút Chạy" — trước đây bị lọc ra, nên học sinh
 * lỡ xoá là không có cách nào lấy lại.
 */
function inoBlocksOf(category: CategoryId) {
  return INO_BLOCKS.filter((b) => b.category === category).map((b) => ({
    kind: 'block' as const,
    type: b.type,
  }));
}

/**
 * Nội dung ngăn kéo cho một nhóm.
 *
 * Trả về chuỗi 'VARIABLE' cho nhóm Biến số: đó là nhóm động, Blockly tự dựng
 * danh sách theo các biến mà học sinh đã tạo, kèm nút "Tạo biến".
 */
export function flyoutContents(category: CategoryId): { contents: unknown[] } | string {
  if (category === 'variables') return 'VARIABLE';

  const builtins = BUILTIN_BLOCKS[category] ?? [];

  return {
    contents: [
      ...inoBlocksOf(category),
      ...(builtins.length && inoBlocksOf(category).length ? [{ kind: 'sep' as const, gap: 12 }] : []),
      ...builtins.map((type) => ({ kind: 'block' as const, type })),
    ],
  };
}

/**
 * Ngăn kéo lúc khởi tạo — loại KHÔNG có cột nhóm bên cạnh,
 * vì cột nhóm đã được thay bằng cột biểu tượng riêng của ứng dụng.
 */
export function initialToolbox() {
  return { kind: 'flyoutToolbox' as const, contents: [] };
}

export { CATEGORY_LABEL };
