import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import pkg from './package.json'; // 👈 NEU

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',

  injectManifest: {
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // ✅ 5 MB
  },

  registerType: 'autoUpdate',
  manifest: {
        short_name: 'SchichtPilot',
        name: 'SchichtPilot Mobile',
        start_url: '/mobile/login',
        display: 'standalone',
        background_color: '#1f2937',
        theme_color: '#1f2937',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version), // 👈 NEU
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  }
});
