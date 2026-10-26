/**
 * Phép ánh xạ của khối "ánh xạ" — hàm toán thuần, KHÔNG thuộc về robot.
 * Để riêng ở đây nên `RobotRuntime` chỉ chứa thứ thật sự liên quan phần cứng.
 */
export function inoMap(
  value: number,
  fromLow: number,
  fromHigh: number,
  toLow: number,
  toHigh: number,
): number {
  if (fromHigh === fromLow) return toLow;
  return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
}
