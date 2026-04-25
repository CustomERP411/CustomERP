import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// In ESM configs (package.json has "type":"module"), Node doesn't provide __dirname.
// Derive it from import.meta.url for both dev and production builds.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Backend for dev proxy: host machine default, or e.g. http://backend:3000 in Docker.
const devApiTarget = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:3000';
const previewTarget = process.env.VITE_DEV_PREVIEW_PROXY || 'http://127.0.0.1:3000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/preview': {
        target: previewTarget,
        changeOrigin: true,
      },
    },
  },
})

