import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // backend API dev server
        changeOrigin: true,
        ws: false
      }
    }
  },
  preview: { port: 5173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react','react-dom'],
          charts: ['highcharts','highcharts-react-official']
        }
      }
    }
  }
});
