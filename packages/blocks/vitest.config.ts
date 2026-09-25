import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Chạy ở Node thuần, KHÔNG dùng jsdom: blockly khai jsdom là peer dependency,
    // cài vào đây sẽ khiến pnpm tạo ra hai bản blockly khác nhau trong dự án
    // và app web không biên dịch được nữa.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
