# Contributing to Parchment

Parchment is a local-first writing studio. The one rule that outranks every
other convention here: **a writer's work is never lost.** Anything that touches
autosave, snapshots, import, migration or the update restart is held to that
standard first and judged on elegance second.

## Setup

```bash
npm ci        # installs deps and copies the Hunspell dictionaries
npm run dev   # web app on http://localhost:5173
```

For the desktop shell you also need the
[Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) (Rust and the
MSVC build tools on Windows):

```bash
npm run tauri:dev
```

## Checks

Run these before opening a pull request. CI runs the same set.

```bash
npm run version:check   # package.json / tauri.conf.json / Cargo.toml agree
npm run typecheck
npm test -- --run
npm run build
```

If you changed anything under `src-tauri/`, also build the desktop app:

```bash
npm run tauri -- build --config src-tauri/tauri.ci.conf.json
```

The CI overlay skips updater-artifact signing, which is what lets the build run
without the release key.

## Layout

| Path | What lives there |
|---|---|
| `src/data/` | Dexie schema and every durable mutation (`repo.ts`) |
| `src/features/` | Editor, planning, Codex, map, assistant, spellcheck, export, updates |
| `src/lib/` | Framework-free helpers: text, tree, semver, release manifest, pending writes |
| `src/store/` | Zustand stores (`useSettings` persists, `useUI` mostly does not) |
| `src-tauri/` | The desktop shell, its capabilities and its bundle configuration |
| `scripts/` | Release tooling: version authority, key generation, manifest verification |
| `docs/` | Architecture decisions, release runbook, install guide |

[`CLAUDE.md`](./CLAUDE.md) is the long-form architecture reference;
[`ROADMAP.md`](./ROADMAP.md) is prioritised delivery intent.

## Conventions

1. **Durable mutations go through `src/data/repo.ts`.** If a change touches more
   than one table, it belongs in one Dexie transaction.
2. **Keep the three representations of a document in step** — TipTap JSON, the
   plain-text mirror and the word count — by going through `saveNodeContent()`.
3. **Debounced writers register with `registerPendingWrite()`** so an update
   restart, a page hide or a route change can flush them. A timer that nobody
   can flush is a data-loss bug waiting for a slow disk.
4. **New settings fields need five edits together**: the TypeScript type, the
   default, the persisted deep-merge, the migration if the shape changed, and
   the Settings UI.
5. **Destructive actions use `confirmDialog`** and prefer soft delete with an
   undo path.
6. **Map code keeps its coordinate spaces separate** — map coordinates, screen
   coordinates, camera state, raw geometry and rendered geometry are five
   different things. Never mix them silently.
7. **Tests come with data-layer changes**, not after them. Tree movement,
   snapshot restore, duplication remapping, backup import and map geometry are
   the places where a regression costs somebody a manuscript.

## Tests

Vitest, with files in `src/**/__tests__/`. The default environment is `node`;
a suite that needs a DOM opts in with `// @vitest-environment jsdom` on its
first line.

`src/__tests__/releaseConfig.test.ts` locks decisions that are expensive to
reverse — the application identifier, the updater key and endpoints, the
workflow safety rules. If it fails, do not update the expectation until you know
what the change would do to somebody who already has Parchment installed.

## Branches and releases

- Work on a branch; open a pull request against `main`.
- Never commit a private signing key, a provider API key, build output or a
  local database. `.gitignore` blocks the obvious patterns and CI checks for
  the rest, but neither is a substitute for looking at your own diff.
- Releases are cut from tags by CI. The full procedure — version bump, tag,
  publish, rollback — is in [`docs/RELEASE.md`](./docs/RELEASE.md).
- Never re-tag a published version. Installed copies only accept a strictly
  newer one; ship `0.2.1` instead.
