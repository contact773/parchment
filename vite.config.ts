import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // nspell ships CommonJS; pre-bundle it so the browser ESM build is happy.
  optimizeDeps: {
    include: ['nspell'],
  },
  // ── Tauri desktop integration ───────────────────────────────────────────
  // Keep Vite quiet so Tauri's CLI output stays readable, and pin the dev
  // server to a fixed port matching tauri.conf.json's devUrl.
  clearScreen: false,
  server: {
    // Tauri never sets PORT, so it keeps the pinned 5173 (strict) that
    // tauri.conf.json's devUrl expects. Tooling that injects PORT (e.g. the
    // preview harness) can run the web build on any free port instead.
    port: Number(process.env.PORT) || 5173,
    strictPort: !process.env.PORT,
    // Allow Cloudflare quick-tunnel hostnames so `cloudflared tunnel --url`
    // can expose the dev server without Vite's host check rejecting it.
    allowedHosts: ['.trycloudflare.com'],
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
})
