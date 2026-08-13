/// <reference types="vitest" />
// `vitest/config` re-exports Vite's defineConfig and adds the `test` block, so
// the app build and the test run share one alias/define configuration.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

// package.json is the version authority (see scripts/version.mjs). Reading it
// here means the About panel, the updater's "current version" and the built
// installer can never disagree.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
  test: {
    // Node by default — most suites are pure logic. Files that need a DOM
    // (localStorage-backed stores, components) opt in with the
    // `@vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
