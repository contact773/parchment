/**
 * Build-time constants injected by Vite (`define` in vite.config.ts).
 *
 * `__APP_VERSION__` is read from package.json at build time, which is the same
 * file `scripts/version.mjs` copies into tauri.conf.json and Cargo.toml — so
 * the version the About panel shows is by construction the version the
 * installer and the updater manifest were built with.
 */
declare const __APP_VERSION__: string
