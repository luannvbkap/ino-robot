import type { RobotConfig, ScenarioConfig } from '@ino/shared';
import type { RobotSpec, RobotState } from '@ino/sim-core';

/**
 * Vị trí xuất phát của robot theo kịch bản.
 * File cấu hình ghi góc bằng độ cho dễ sửa tay; mô phỏng dùng radian.
 */
export function startPoseOf(scenario: ScenarioConfig | undefined): Partial<RobotState> {
  if (!scenario) return {};
  const [x, , z] = scenario.robotStart.position;
  return { x, z, heading: (scenario.robotStart.rotation * Math.PI) / 180 };
}

/** Thông số chuyển động lấy từ file cấu hình robot */
export function specOf(robot: RobotConfig | undefined): RobotSpec | undefined {
  return robot ? { wheelBase: robot.wheelBase, maxSpeed: robot.maxSpeed } : undefined;
}
