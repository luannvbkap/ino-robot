/**
 * Lớp trung gian giữa chương trình của học sinh và engine mô phỏng.
 *
 * Danh sách hàm dưới đây lấy ĐÚNG từ phần `toJS` của các khối lệnh — sai một
 * tên là chương trình chạy lỗi. Xem PTTK-02 mục 6b.
 *
 * Bản cài đặt đầu tiên là `SimRobot` (chạy trên sa bàn ảo). Sau này thêm
 * `RealRobot` gửi lệnh xuống mạch thật thì không phải sửa bộ sinh mã.
 */
export interface RobotRuntime {
  /* --- theo quãng đường / góc: chạy đủ rồi tự dừng --- */
  forwardCm(speed: number, cm: number): Promise<void>;
  backwardCm(speed: number, cm: number): Promise<void>;
  turnLeftDeg(speed: number, degrees: number): Promise<void>;
  turnRightDeg(speed: number, degrees: number): Promise<void>;

  /* --- chuyển động có thời gian: chạy đủ số giây rồi tự dừng --- */
  forward(speed: number, seconds: number): Promise<void>;
  backward(speed: number, seconds: number): Promise<void>;
  turnLeftFor(speed: number, seconds: number): Promise<void>;
  turnRightFor(speed: number, seconds: number): Promise<void>;

  /* --- chuyển động liên tục: chạy tới khi gặp lệnh khác --- */
  forwardOn(speed: number): Promise<void>;
  backwardOn(speed: number): Promise<void>;
  turnLeft(speed: number): Promise<void>;
  turnRight(speed: number): Promise<void>;
  drive(left: number, right: number): Promise<void>;
  stop(): Promise<void>;

  /* --- cảm biến: trả về ngay --- */
  lineSensor(side: 'LEFT' | 'RIGHT'): boolean;
  distance(): number;

  /* --- hệ thống --- */
  wait(seconds: number): Promise<void>;
  /** Nhường một bước mô phỏng — chèn ở cuối mỗi vòng lặp để robot kịp di chuyển */
  tick(): Promise<void>;
  print(value: unknown): void;
}

/**
 * Trạng thái robot tại một thời điểm, đơn vị mét và radian.
 *
 * Hệ trục trùng với Three.js: Y hướng lên, mặt sàn là mặt phẳng XZ.
 */
export interface RobotState {
  x: number;
  z: number;
  /**
   * Góc quay quanh trục Y, radian, dương là quay trái (ngược chiều kim đồng hồ
   * khi nhìn từ trên xuống). 0 là hướng theo +X. Dùng thẳng làm `rotation.y`.
   */
  heading: number;
  /** tốc độ hai bánh, thang -100…100 */
  left: number;
  right: number;
  /** thời gian MÔ PHỎNG đã trôi, giây — không phải thời gian thật */
  time: number;
}

export interface RobotSpec {
  /** khoảng cách hai bánh, mét */
  wheelBase: number;
  /** tốc độ tối đa (m/s) ứng với mức 100 */
  maxSpeed: number;
}

/**
 * Nguồn giá trị cảm biến. Ở M2 dùng bản cố định; M4 thay bằng bản đọc thật
 * từ sa bàn mà không phải sửa gì trong SimRobot.
 */
export interface SensorSource {
  lineSensor(state: RobotState, side: 'LEFT' | 'RIGHT'): boolean;
  distance(state: RobotState): number;
}

export interface SimRobotOptions {
  spec?: RobotSpec;
  sensors?: SensorSource;
  /** Nhận chữ từ khối "in ra" */
  onPrint?: (text: string) => void;
  /** Cảnh báo cho người dùng, ví dụ cảm biến chưa hoạt động */
  onWarning?: (text: string) => void;
}
