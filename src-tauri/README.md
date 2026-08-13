# The Parchment desktop shell

Three configuration files, because Tauri merges an overlay over the base config
at build time and the update channel has to be compiled in.

Tauri validates its configuration with `additionalProperties: false`, so these
files cannot carry `"//"` comment keys — the build fails with *"Additional
properties are not allowed"*. That is why the explanation lives here instead.
`src/__tests__/releaseConfig.test.ts` checks the overlays against the real
schema's property list so it cannot regress.

## `tauri.conf.json` — the base

Window, bundle, installer and updater configuration. Its
`plugins.updater.endpoints` points at the **stable** manifest
(`releases/latest/download/latest.json`), and `plugins.updater.pubkey` holds the
minisign **public** key. Used on its own by `npm run tauri:build`, which is the
distribution build.

## `tauri.preview.conf.json` — the preview channel

```bash
tauri build --config src-tauri/tauri.preview.conf.json
```

Repoints the updater at the rolling `preview` tag. The Tauri updater reads its
endpoints from the configuration compiled into the binary and the JavaScript
`check()` API cannot override them, so a build follows exactly one channel for
its whole life. A writer opts into previews by installing a preview build, and
returns to stable by installing a stable installer — a stable `X.Y.Z` always
sorts above every `X.Y.Z-preview.N`, so it installs cleanly over the top.

`productName` and `identifier` are deliberately *not* overridden: a preview is
an upgrade of the same installed application, not a second copy with its own
IndexedDB.

The public key is not overridden either — both channels are signed by one key.

## `tauri.ci.conf.json` — unsigned pull-request builds

```bash
tauri build --config src-tauri/tauri.ci.conf.json
```

Turns off updater-artifact generation so a pull request can prove the installer
still packages without the signing key. Signing secrets are never exposed to
pull requests, and a build that quietly produced *unsigned* updater artifacts
would be worse than one that produces none. Release builds never use this file.

## Related

- [`../docs/adr/0001-release-channels-and-updates.md`](../docs/adr/0001-release-channels-and-updates.md) — why it works this way
- [`../docs/RELEASE.md`](../docs/RELEASE.md) — cutting a release, secrets, rollback
