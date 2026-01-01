import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Needed for Docker
    watch: {
      usePolling: true, // Needed for Docker on Windows
    },
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

