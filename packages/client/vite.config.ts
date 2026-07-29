import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Exact match -> the package barrel.
      { find: /^@botville\/shared$/, replacement: path.resolve(__dirname, '../shared/src/index.ts') },
      // Subpath -> a file in src/. A string alias breaks here: rollup
      // matches by prefix and glues the path THROUGH index.ts (ENOTDIR).
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
