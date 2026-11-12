import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind explicitly to IPv4 so the dev server is reachable at
    // http://127.0.0.1:5173 on every machine. Without this, Vite resolves
    // "localhost" to ::1 (IPv6) first on Windows and the server ends up
    // unreachable over IPv4.
    host: '127.0.0.1',
    port: 5173,
    // Proxy /api to the Django backend during development so the browser
    // never hits a cross-origin request.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Evidence files are served by Django from MEDIA_ROOT. Without this
      // proxy the SPA fallback answers /media/... with index.html, so
      // uploaded photos and videos would never render in the browser.
      '/media': {
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
