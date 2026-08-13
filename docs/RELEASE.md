# Parchment release runbook

Everything a maintainer needs to publish a release that installed copies will
accept — and to withdraw one that should not have shipped.

Background and the reasoning behind these choices:
[ADR 0001](./adr/0001-release-channels-and-updates.md).

---

## One-time setup

### 1. Generate the updater signing key

```bash
npm run updater:keygen
```

Writes the key pair to `~/.parchment/updater/parchment-updater.key(.pub)` —
**outside** the repository; the script refuses to write inside it — and prints
the public key.

> **This key is the application's identity.** Every installed copy verifies
> updates against the matching public key. Rotating it means no existing
> installation can ever update again; those writers must reinstall by hand.
> Store the private key in a password manager as well as in GitHub.

If a key already exists, the command prints its public key instead of replacing
it. `--force` replaces it; read the warning above first.

### 2. Commit the public key

Paste the printed public key into `src-tauri/tauri.conf.json` at
`plugins.updater.pubkey`. Only ever the **public** key — the tests in
`src/__tests__/releaseConfig.test.ts` fail if anything resembling a private key
reaches the config, and `.gitignore` blocks `*.key` as a backstop.

### 3. Configure the GitHub repository

**Settings → Secrets and variables → Actions → Secrets**

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | the entire contents of `~/.parchment/updater/parchment-updater.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | **only if the key has a password.** Leave it uncreated otherwise — GitHub refuses to store an empty secret value, and an absent secret interpolates to the empty string the signer expects. |

**Settings → Secrets and variables → Actions → Variables** *(optional)*

| Variable | Effect |
|---|---|
| `PUBLISH_PREVIEWS` | set to `true` to publish a preview on every push to `main`. Unset, previews are cut by hand from the Actions tab. |

**Settings → Actions → General → Workflow permissions**

Select **Read and write permissions** and press **Save** (the button sits below
the radio buttons and is easy to miss).

The release jobs declare `contents: write` themselves, so in principle the
restrictive default should work. In practice it does not always take effect —
notably, **re-running an existing run replays that run's original permissions**,
so a settings change only reaches a *new* run. Preflight probes the token and
fails in two seconds with instructions rather than after an eight-minute build.

If write access still cannot be granted, add the escape hatch:

| Secret | Value |
|---|---|
| `RELEASE_TOKEN` | A fine-grained personal access token (Settings → Developer settings → Personal access tokens → Fine-grained), scoped to this repository only, with **Contents: Read and write**. |

Every workflow prefers `RELEASE_TOKEN` when present and falls back to the
built-in `GITHUB_TOKEN`, so adding it needs no code change. Give it an expiry
and a calendar reminder — an expired token fails the release at preflight.

---

## Cutting a stable release

```bash
# 1. Start from a clean, green main
git checkout main && git pull
npm ci
npm run typecheck && npm test -- --run && npm run build

# 2. Bump the version everywhere (refuses anything not strictly newer)
npm run version:set -- 0.2.0

# 3. Write the release notes
$EDITOR CHANGELOG.md

# 4. Commit and tag. The tag MUST be v<version>; CI checks.
git commit -am "Release 0.2.0"
git tag v0.2.0
git push origin main --follow-tags
```

The `Release` workflow then:

1. **Preflight** — refuses to continue if `TAURI_SIGNING_PRIVATE_KEY` is
   missing, if the version files disagree, or if the tag is not `v<version>`;
   runs typecheck, tests and the web build.
2. **Build** — builds and signs the NSIS installer and the updater archive on
   `windows-latest`, and uploads them to a **draft** GitHub Release together
   with `latest.json`.
3. **Verify** — downloads that `latest.json` and checks it with
   `scripts/verify-release.mjs`: right version, every promised platform present,
   every asset URL referencing this tag, no empty signature.
4. **Publish** — only now flips the draft to published and marks it latest.

Until step 4, `releases/latest` still points at the previous release, so no
installed copy sees anything.

### After the workflow finishes

- [ ] The release page lists `Parchment_<version>_x64-setup.exe`,
      `Parchment_<version>_x64-setup.exe.sig` and `latest.json`.
      (Tauri 2 signs the NSIS setup program itself; the `.nsis.zip` form belongs
      to the v1-compatible mode, which Parchment does not use.)
- [ ] Install the setup program on a machine that already has Parchment, with a
      project open beforehand — confirm the projects are still there afterwards.
- [ ] On a machine running the **previous** version, open
      Settings → Updates → *Check now*: it should offer the new version,
      download it, and restart into it.
- [ ] Settings → About shows the new version.

---

## Cutting a preview

Actions → **Preview** → *Run workflow*. The version is derived automatically
(`0.2.0` in `package.json` produces `0.2.1-preview.<run number>`), so nothing is
committed and `main` keeps its own version.

Previews publish to the rolling `preview` tag as a GitHub prerelease. Only
builds made from `src-tauri/tauri.preview.conf.json` poll that manifest, so
stable installations never see them.

A preview device returns to stable by installing any stable release newer than
its preview base — `0.2.1` supersedes every `0.2.1-preview.N`.

---

## Rolling back

An update cannot be un-installed remotely. Rollback means "stop offering the bad
release, and give writers something newer that is good".

**Immediately — stop the bleeding (under a minute):**

1. GitHub → Releases → the bad release → *Edit* → tick **Set as a pre-release**
   → *Update release*.
   `releases/latest` now resolves to the previous good release, so copies that
   have not updated yet stop being offered the bad one.

**Then — recover the copies that already updated:**

2. Fix the problem on `main`.
3. Release a **new, higher** version (`0.2.1`, not a re-tagged `0.2.0`). An
   installed copy will never accept an equal or lower version, and re-tagging
   would leave every already-updated machine stranded.
4. If the fix will take time, tell writers where the previous installer is: the
   old release page still has its setup program, and installing it over the top
   works. Their projects live in the WebView data directory, not in the
   application folder, and are not touched by installing or uninstalling.

**If a release was published by mistake but nobody has it yet:** delete the
release *and* the tag (`git push --delete origin v0.2.0`), then re-tag. Only do
this within minutes of publishing — once a copy has updated, use the path above.

---

## Where things live

| Thing | Location |
|---|---|
| Version authority | `package.json` → `scripts/version.mjs` → `tauri.conf.json`, `Cargo.toml` |
| Updater public key | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| Updater private key | `~/.parchment/updater/parchment-updater.key` + GitHub secret |
| Stable manifest | `https://github.com/contact773/parchment/releases/latest/download/latest.json` |
| Preview manifest | `https://github.com/contact773/parchment/releases/download/preview/latest.json` |
| Writer's projects | WebView2 IndexedDB under `%LOCALAPPDATA%\com.grinmedia.parchment\` |
| Update state machine | `src/features/updates/updateModel.ts` |
| Release configuration tests | `src/__tests__/releaseConfig.test.ts` |

## Troubleshooting a release

| Symptom | Cause and fix |
|---|---|
| Preflight fails on "Refusing to publish an unsigned release" | `TAURI_SIGNING_PRIVATE_KEY` is not set. Add the secret; see one-time setup. |
| Preflight fails on "Tag does not match package.json" | You tagged without bumping, or bumped without committing. `npm run version:set -- <v>`, commit, delete the tag, re-tag. |
| Verify fails on "missing required target" | The build matrix did not produce a platform listed in `REQUIRED_TARGETS`. The release stays a draft — fix the matrix or the list. |
| Verify fails on "url does not reference v…" | The manifest points at a previous release's assets. Delete the draft and re-run. |
| Release published but no copy is offered it | Confirm it is *not* marked prerelease, that it is *latest*, and that `latest.json` is attached. |
| A writer sees "failed its signature check" | The artifact was signed with a different key than the one in their build. Do not work around it — rotating the key is a break; see the ADR. |
