import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Nạp apps/api/.env nếu có. Khi chạy thật thì biến môi trường
// do hệ thống cung cấp, không có file .env — nên bỏ qua lỗi.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  /* không có file .env, dùng biến môi trường của hệ thống */
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET phải dài ít nhất 16 ký tự'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Thiếu hoặc sai biến môi trường trong apps/api/.env:');
  console.error(parsed.error.issues.map((i) => `   - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
