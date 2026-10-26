/**
 * Khai báo kiểu cho js-interpreter — gói này không kèm file .d.ts.
 * Chỉ khai những phần dự án thật sự dùng, không khai bừa cho đủ.
 *
 * Tài liệu gốc: https://neil.fraser.name/software/JS-Interpreter/docs.html
 */
declare module 'js-interpreter' {
  /** Giá trị bên trong trình thông dịch — không phải giá trị JavaScript thường */
  export type PseudoValue = unknown;

  export interface PseudoObject {
    readonly __pseudo: unique symbol;
  }

  export default class Interpreter {
    constructor(code: string, initFunc?: (interpreter: Interpreter, globalObject: PseudoObject) => void);

    /** Chạy một lệnh. Trả về false khi chương trình đã kết thúc. */
    step(): boolean;

    /** Chạy tới hết. Trả về true nếu bị dừng giữa chừng vì lệnh bất đồng bộ. */
    run(): boolean;

    /** Bọc một hàm thường để gọi được từ trong trình thông dịch */
    createNativeFunction(fn: (...args: never[]) => unknown): PseudoValue;

    /**
     * Bọc một hàm chờ được. Trình thông dịch dừng lại cho tới khi hàm gọi
     * `callback` — tham số cuối cùng mà nó nhận được.
     */
    createAsyncFunction(fn: (...args: never[]) => void): PseudoValue;

    setProperty(obj: PseudoObject | PseudoValue, name: string, value: PseudoValue): void;

    /** Tạo một đối tượng rỗng bên trong trình thông dịch */
    nativeToPseudo(value: object): PseudoObject;

    globalObject: PseudoObject;
  }
}
