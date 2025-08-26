import { defineConfig } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
// Load root .env so we can fallback to CLIENT_ID for the frontend without requiring a duplicate VITE_ variable
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

// Resolve client id precedence: explicit VITE_DISCORD_CLIENT_ID > VITE_CLIENT_ID > backend CLIENT_ID
const resolvedClientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.VITE_CLIENT_ID || process.env.CLIENT_ID || '';

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
  ,define: {
    'import.meta.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(resolvedClientId)
  }
});
