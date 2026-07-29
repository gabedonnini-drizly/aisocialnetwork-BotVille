import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Точное совпадение -> бочка пакета.
      { find: /^@botville\/shared$/, replacement: path.resolve(__dirname, '../shared/src/index.ts') },
      // Подпуть -> файл в src/. Строковый alias здесь ломается: rollup
      // сопоставляет по префиксу и клеит путь ЧЕРЕЗ index.ts (ENOTDIR).
      { find: /^@botville\/shared\//, replacement: path.resolve(__dirname, '../shared/src') + '/' },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
