/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Bind 0.0.0.0 rather than just 127.0.0.1, so another device on the wifi —
    // or a tunnel — can reach the dev server at all.
    host: true,
    port: 5173,
    strictPort: true,

    // Vite refuses requests whose Host header it does not recognise, as a
    // DNS-rebinding defence. A tunnel domain is random and changes every run,
    // so there is nothing to whitelist. Dev server only — never ship this.
    allowedHosts: true,

    proxy: {
      /**
       * Why this exists, and why it is better than pointing VITE_API_URL at a
       * LAN address.
       *
       * A phone loads the page from http://192.168.x.x:5173 (or a tunnel) and
       * calls the *relative* path `/api/...`. To the browser that is
       * same-origin: no preflight, no CORS, and nothing to add to
       * CORS_ORIGINS. Vite receives it here and forwards it to the backend
       * running on this machine.
       *
       * Without it, the app would call http://localhost:4000 — which, on a
       * phone, means the phone itself.
       *
       * Requires VITE_API_URL to be EMPTY so api.ts builds relative URLs.
       */
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          // Strip Origin so the backend sees an ordinary same-origin request
          // and its allowlist never comes into it.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
