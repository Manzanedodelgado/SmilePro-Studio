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
    // Increase chunk size warning threshold (Cornerstone is large by nature)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core: always loaded (small)
          react:       ['react', 'react-dom'],
          // Icons: tree-shaken, loaded with UI
          lucide:      ['lucide-react'],
          // Heavy DICOM libs: loaded only when Radiología module is used (lazy)
          cornerstone: ['@cornerstonejs/core', '@cornerstonejs/tools', '@cornerstonejs/dicom-image-loader'],
          dicom:       ['dicom-parser'],
          // Socket.io: loaded when real-time features init
          socketio:    ['socket.io-client'],
        },
      },
    },
  },
});
