# ADR 0001 — Release channels, version authority and automatic updates

- **Status**: Accepted
- **Date**: 2026-08-13
- **Supersedes**: the `npm run desktop:build` "copy the raw executable" distribution model

## Context

Parchment is a local-first desktop application. Until now the only way to get a
new build onto a machine was to copy `Parchment.exe` by hand. The delivery
requirement is that a maintainer pushes an approved release to GitHub and every
installed copy can discover, verify, download and install it without a manual
reinstall.

A `git push` cannot do that on its own. An installed application needs a
platform artifact, a version strictly newer than its own, and a signature it can
verify against a key it already trusts.

## Decisions

### 1. `package.json` is the single version authority

`scripts/version.mjs` copies its `version` into `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `package-lock.json` and `src-tauri/Cargo.lock`.
`npm run version:check` fails CI if they disagree, and `npm run version:set`
refuses a version that is not strictly newer than the current one.

*Why:* an installer whose version disagrees with its updater manifest either
never offers an update or offers one forever. One authority plus a CI gate makes
that class of bug impossible rather than unlikely.

### 2. Distribution is an NSIS per-user installer, published to GitHub Releases

`bundle.targets` is `["nsis"]` and `bundle.windows.nsis.installMode` is
`currentUser`.

*Why:* per-user installation needs no administrator, which suits a single-writer
writing tool. MSI was not added — every extra format multiplies the install /
upgrade / uninstall test surface, and nothing yet requires machine-wide
deployment. `desktop:build` survives as a developer convenience only; it is not
a distribution path.

### 3. The application identifier is frozen

`com.grinmedia.parchment`, permanently. Changing it after the first public
release produces a *second* installation on every machine, with its own empty
IndexedDB. `src/__tests__/releaseConfig.test.ts` asserts it.

### 4. Updates use the Tauri updater with a minisign key pair

The public key is committed in `tauri.conf.json`. The private key exists only in
the maintainer's key store (`~/.parchment/updater/`) and in the
`TAURI_SIGNING_PRIVATE_KEY` GitHub Actions secret. Artifacts are signed in CI;
the installed application refuses anything whose signature does not verify.

Rotating the key breaks updates for every already-installed copy, which is why
the key was generated before the first public release and why the rotation
procedure in `docs/RELEASE.md` is explicit about that cost.

### 5. Two channels, chosen at build time rather than at runtime

| Channel | Trigger | Endpoint | Audience |
|---|---|---|---|
| Stable | a `v*` tag | `releases/latest/download/latest.json` | everyone |
| Preview | `workflow_dispatch`, or pushes to `main` once `PUBLISH_PREVIEWS=true` | `releases/download/preview/latest.json` | maintainers and test devices |

The Tauri updater reads its endpoint list from the configuration compiled into
the binary, and the JavaScript `check()` API cannot override it. Channel
selection is therefore baked into the artifact:
`src-tauri/tauri.preview.conf.json` overlays the preview endpoint at build time.

**Tradeoff, stated plainly:** a writer cannot flip channels from inside the app.
They opt into previews by installing a preview build, and return to stable by
installing a stable installer. That works cleanly because preview versions are
derived as `X.Y.(Z+1)-preview.N`, and SemVer sorts every `0.2.1-preview.N` below
the stable `0.2.1` — so the next stable release supersedes any preview and
installs over it.

The alternative — a Rust command that builds an updater with a runtime-selected
endpoint — would allow in-app switching at the cost of reimplementing the
download/progress/install path outside the maintained plugin. It was rejected
for the first pipeline and can be revisited if writers actually ask to switch
channels without reinstalling.

`main` is *not* a production channel. Publishing every commit to every writer
satisfies the most literal reading of "push once, update everywhere" but makes
every commit a release; a broken commit would reach every installation within
minutes. Previews are therefore opt-in twice: the repository variable must be
set, and the writer must be running a preview build.

### 6. Releases are published only after their manifest verifies

`release.yml` builds into a **draft** release, downloads the `latest.json` it
produced, checks it with `scripts/verify-release.mjs` (right version, every
promised platform, every asset URL referencing this tag, no empty signature),
and only then flips the draft to published.

*Why:* `releases/latest` is what every installed copy polls, and GitHub excludes
drafts and prereleases from it. A failed or half-uploaded release stays a draft
and is invisible to writers. Failure leaves the previous release as latest.

### 7. Updates never restart over unsaved work

`installUpdate()` calls `flushPendingWrites()` — the registry the editor's
700 ms autosave and the world map's 300 ms geometry save register with — and
**aborts the update** if any writer fails or the flush times out. The installed
copy is untouched at that point, so aborting is always the safe outcome.

Updates are never installed silently. The startup check is deferred by eight
seconds, runs at most every six hours, requires no project to be open, and only
ever results in a dismissible card in the corner.

## Consequences

- A maintainer bumps the version, commits, tags `vX.Y.Z`, and CI does the rest.
- A writer on stable gets exactly the tagged releases; previews cannot reach them.
- Losing the private key means no installed copy can ever be updated again — the
  key belongs in a password manager as well as in the GitHub secret.
- macOS and Linux are unimplemented, not merely unbuilt: each needs its own
  signing story before it joins the matrix. `REQUIRED_TARGETS` in
  `src/lib/releaseManifest.ts` is the list a release is checked against, and it
  is where those platforms get added.
