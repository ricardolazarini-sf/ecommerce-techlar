import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the SPA runs on :5173 and proxies API/health calls to the
// Express server on :3001. In production the server serves the built dist/.
export default defineConfig({
  plugins: [react()],
  // `npm run dev:mock` liga a API falsa de src/api/mock.js. É constante de build
  // em vez de leitura de import.meta.env porque assim o valor chega ao Rollup
  // como `false` literal, e o mock — produtos e senha de demonstração inclusos —
  // é podado do bundle de produção em vez de viajar nele como código morto.
  define: {
    __TECHLAR_MOCK__: JSON.stringify(process.env.VITE_MOCK === '1'),
  },
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
