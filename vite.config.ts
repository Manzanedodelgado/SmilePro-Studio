import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// SmilePro Studio — vite.config.ts canónico
// Puerto 5176 · sin plugins de debugging ni workarounds
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5176,
    host: true,
    proxy: {
      // Backend Node.js en 3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Orthanc DICOM server en 8042 — evita CORS en el browser
      '/orthanc': {
        target: 'http://localhost:8042',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/orthanc/, ''),
      },
    },
  },
  // Fix: Cornerstone3D workers internos usan IIFE → forzar ES para compatibilidad con code-splitting
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: ['@cornerstonejs/core', '@cornerstonejs/tools', 'dicom-parser'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          react:      ['react', 'react-dom'],
          lucide:     ['lucide-react'],
          cornerstone:['@cornerstonejs/core', '@cornerstonejs/tools'],
        },
      },
    },
  },
});
