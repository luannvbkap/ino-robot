/**
 * Mỗi khối lệnh được khai trong MỘT file duy nhất, gồm cả hai bộ sinh mã:
 *   toJS  — chạy mô phỏng robot ảo (mốc M2)
 *   toCpp — hiển thị cho học sinh và nạp xuống robot thật (mốc v2)
 *
 * Để hai bộ ở cùng chỗ là có chủ đích: tách ra hai nơi thì chỉ cần quên
 * cập nhật một bên là mô phỏng chạy khác robot thật, loại lỗi rất khó tìm.
 */

export type CategoryId =
  | 'motion'
  | 'sensors'
  | 'control'
  | 'logic'
  | 'math'
  | 'variables'
  | 'serial';

/** Hình dạng khối, quyết định cách nó ghép với khối khác */
export type BlockShape =
  /** khối lệnh thường, có khớp trên và dưới */
  | 'statement'
  /** khối mũ, chỉ có khớp dưới — bắt đầu chương trình */
  | 'hat'
  /** khối trả về số, cắm vào ô trống */
  | 'number'
  /** khối trả về đúng/sai, cắm vào ô điều kiện */
  | 'boolean';

export interface BlockArg {
  name: string;
  kind: 'number' | 'dropdown' | 'input';
  /** kind = 'number': giá trị mặc định và khoảng cho phép */
  value?: number;
  min?: number;
  max?: number;
  /** kind = 'dropdown': danh sách [nhãn hiển thị, giá trị] */
  options?: [string, string][];
  /** kind = 'input': kiểu dữ liệu được phép cắm vào */
  check?: 'Number' | 'Boolean';
}

/** Giá trị các tham số sau khi đã dịch, dùng cho hai hàm sinh mã */
export type Args = Record<string, string>;

export interface BlockSpec {
  type: string;
  category: CategoryId;
  /** Mẫu câu tiếng Việt, %1 %2… là vị trí tham số */
  message: string;
  args: BlockArg[];
  shape: BlockShape;
  tooltip: string;
  /**
   * Các ô chứa lệnh con bên trong khối (lặp, nếu…).
   * Mã của từng ô được truyền vào hai hàm sinh mã theo đúng `name`.
   * Ví dụ nếu–thì–ngược lại có hai ô: DO và ELSE.
   */
  bodies?: { name: string; label?: string }[];
  toJS: (a: Args) => string;
  toCpp: (a: Args) => string;
}

export const CATEGORY_COLOR: Record<CategoryId, string> = {
  motion: '#004ac6',
  sensors: '#006a61',
  control: '#f59e0b',
  logic: '#16a34a',
  math: '#632ecd',
  variables: '#ea580c',
  serial: '#475569',
};

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  motion: 'Chuyển động',
  sensors: 'Cảm biến',
  control: 'Điều khiển',
  logic: 'Logic',
  math: 'Toán',
  variables: 'Biến số',
  serial: 'Hiển thị',
};
