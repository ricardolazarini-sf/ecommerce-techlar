import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the SPA runs on :5173 and proxies API/health calls to the
// Express server on :3001. In production the server serves the built dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
