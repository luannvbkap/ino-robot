import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // package dùng chung là mã TypeScript thuần, trỏ thẳng vào nguồn
      '@ino/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Gọi API cùng origin để cookie refresh token hoạt động bình thường
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
