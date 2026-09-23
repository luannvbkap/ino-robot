import { z } from 'zod';

/* ------------------------------------------------------------------ *
 * Schema dùng chung cho cả frontend và backend.
 * Khai một lần ở đây để hai bên không bao giờ lệch nhau.
 * ------------------------------------------------------------------ */

export const ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/* ----------------------------- Auth ------------------------------- */

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(128),
  displayName: z.string().min(1, 'Chưa nhập tên hiển thị').max(60),
});

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Chưa nhập mật khẩu'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

/* ---------------------------- Project ----------------------------- */

/** Giới hạn dung lượng — xem PTTK-02 mục 10 */
export const MAX_WORKSPACE_BYTES = 1_000_000; // 1 MB
export const MAX_THUMBNAIL_CHARS = 300_000; // ~200 KB ảnh sau khi mã hoá base64

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Chưa đặt tên bài làm').max(80),
  robotId: z.string().max(60).optional(),
  scenarioId: z.string().max(60).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    /** Nội dung khối lệnh, định dạng JSON của Blockly */
    workspace: z.unknown().optional(),
    robotId: z.string().max(60).optional(),
    scenarioId: z.string().max(60).optional(),
    thumbnail: z.string().max(MAX_THUMBNAIL_CHARS).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export interface ProjectSummary {
  id: string;
  name: string;
  robotId: string;
  scenarioId: string;
  thumbnail: string | null;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  workspace: unknown;
}

/* --------------------- Cấu hình robot / kịch bản -------------------- */

export interface SensorConfig {
  id: string;
  type: 'line' | 'ultrasonic';
  position: [number, number, number];
  maxRange?: number;
}

export interface RobotConfig {
  id: string;
  name: string;
  model: string;
  /** khoảng cách hai bánh, đơn vị mét */
  wheelBase: number;
  /** tốc độ tối đa (m/s) ứng với mức 100 */
  maxSpeed: number;
  sensors: SensorConfig[];
  blocks: string[];
}

export interface ScenarioConfig {
  id: string;
  name: string;
  ground: string;
  size: [number, number];
  robotStart: { position: [number, number, number]; rotation: number };
  obstacles: { position: [number, number, number]; size: [number, number, number] }[];
  goal?: { type: string; position: [number, number, number]; radius: number };
}

/* ------------------------------ Lỗi ------------------------------- */

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
