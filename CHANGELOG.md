# Changelog

Notable changes to Parchment. Versions follow [SemVer](https://semver.org/);
`package.json` is the authority and everything else is derived from it.

Migration or backup requirements, when a release has any, are called out under
the release heading.

## Unreleased

### Added

- **A real Windows installer.** `npm run tauri:build` now produces an NSIS setup
  program that installs per user, with no administrator prompt. The old
  `desktop:build` script remains, but only as a developer convenience — it
  copies a raw executable and is not a distribution path.
- **Signed automatic updates.** Parchment checks for updates a few seconds after
  launch (at most once every six hours), and on demand from
  **Settings → Updates** or **Help → Check for Updates…**. Updates are verified
  against the publisher's key before anything is installed; an unsigned or
  modified artifact is rejected. Nothing downloads or installs without the
  writer choosing to.
- **Update states you can actually read**: checking, up to date, available,
  downloading with progress, ready, installing, restarting, and a distinct
  explanation for offline, timeout, signature failure, unconfigured build,
  unreadable manifest, failed download and failed install — each with a
  "copy diagnostic details" path that contains no part of your writing.
- **A preview channel** for testing unreleased builds, published as clearly
  marked prereleases. Opt in by installing a preview build; return to stable by
  installing the next stable release.
- **Release automation**: a CI quality gate on every pull request, a tag-driven
  stable release workflow that publishes only after verifying the manifest
  installed copies will poll, and an opt-in preview workflow.
- Documentation: [`docs/RELEASE.md`](docs/RELEASE.md) (runbook and rollback),
  [`docs/INSTALL.md`](docs/INSTALL.md) (for writers),
  [`docs/adr/0001-release-channels-and-updates.md`](docs/adr/0001-release-channels-and-updates.md),
  and [`CONTRIBUTING.md`](CONTRIBUTING.md).

### Changed

- The world map now flushes its pending geometry save when you leave the map,
  hide the window or close the app. Previously the last gesture could sit in a
  300 ms timer that a navigation threw away.
- Settings → About reports the real build version instead of a hard-coded one.

### Safety

- An update will not restart Parchment until the open document and map have been
  written to disk. If they cannot be, the update is cancelled and the installed
  copy is left exactly as it was.
- A version equal to or older than the running one is never offered as an
  update, and an unparseable version from the release endpoint is treated as
  "nothing new" rather than as an upgrade.

## 0.1.0

First working build: manuscript binder, TipTap editor with script and poetry
modes, planning boards, Codex, snapshots, world map, multilingual spellcheck,
Story Assistant, themes, imports and exports, and a Tauri desktop shell.
