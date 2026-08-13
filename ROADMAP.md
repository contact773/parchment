# Parchment Enhancement Roadmap

This document turns the project research in [`CLAUDE.md`](./CLAUDE.md) into an implementation roadmap. It is intentionally ordered by dependency: release safety and data integrity come before ambitious feature work, and the world-map work is separated into geometry, interaction, and visual-system improvements so that it can be evaluated in controlled increments.

The roadmap is written for the current repository state, not for an abstract rewrite. The current application is a local-first React/Vite writing studio running in a Tauri 2 desktop shell. It already contains the main product surfaces—Dashboard, Workspace, Binder, editor, planning boards, Codex, snapshots, import/export, Story Assistant, spellcheck, and a freehand world map—but its distribution and update mechanism are not yet production-ready.

## Product direction

Parchment should become a dependable, local-first writing and worldbuilding studio that feels equally coherent in the browser and as an installed desktop application.

The core promise is:

1. A writer can open or create a project quickly.
2. The project remains usable without a network connection.
3. Writing, planning, Codex, maps, snapshots, and exports share one understandable project model.
4. The application protects the writer’s data during edits, imports, restores, crashes, and upgrades.
5. Installed copies can receive signed updates through a predictable release channel without requiring the user to reinstall manually.
6. The interface is calm, readable, keyboard-friendly, and visually consistent at the smallest supported window as well as at a large monitor size.

## Non-negotiable constraints

- Preserve the local-first architecture. Do not make the editor dependent on a hosted database or an always-on account.
- Treat IndexedDB/Dexie data as user data. Schema changes require a migration plan, backup/recovery behavior, and tests.
- Do not silently discard user content during autosave, import, duplicate, move, merge, delete, or restore operations.
- Keep the browser build working unless a desktop-only capability genuinely cannot be represented in the browser.
- Use Tauri-native capabilities through the existing permission model. Do not introduce unrestricted native commands as a shortcut.
- Keep signing keys, updater private keys, API keys, and provider credentials out of the repository and out of build logs.
- Every phase must leave the application buildable and testable.
- A raw `git push` is source-code publication, not an installed-app update. Automatic updates require a versioned, signed artifact and a client-side updater.

## Current baseline

### Already present

- React 18, TypeScript, Vite, Tailwind, TipTap, Zustand, Dexie, Vitest, and Tauri 2.
- A local project database covering projects, binder nodes, characters, locations, plot threads, snapshots, world elements, and maps.
- Starter project creation and project duplication with ID remapping.
- Binder tree navigation, keyboard navigation, multi-select, collapse/expand, drag/reorder, duplicate, merge, archive, trash, and restore flows.
- A TipTap editor with writing modes, typography, alignment, color/highlight, character count, autosave, snapshots, and spellcheck decorations.
- Planning surfaces including outline, corkboard, timeline, snapshots, and a worldbuilding manager.
- Local heuristic Story Assistant analysis and an optional provider abstraction for advanced analysis.
- Import/export paths for text, Markdown, DOCX, ePub, project exports, and full backups.
- A Tauri shell with native menus, single-instance behavior, window-state persistence, native dialogs, opener support, and bundle metadata.
- World-map PNG/SVG export and an outliner.

### Current gaps that affect the roadmap

- `src-tauri/Cargo.toml` and `package.json` do not yet include the Tauri updater plugin.
- `src-tauri/tauri.conf.json` has bundle metadata, but there is no signed-release pipeline or GitHub Actions workflow.
- `npm run desktop:build` creates a raw executable copy for convenience; it is not a user-facing installer and should not be treated as the distribution path.
- The current app version is `0.1.0` in the frontend and Tauri metadata. Release versioning is not yet automated or governed.
- The map editor’s main weaknesses are interaction geometry and visual feedback: smoothing can overshoot, freehand sampling depends on pointer speed, cut semantics do not match the visible stroke, pan can lose the map, labels use weak anchors, and inspector/legend overlays compete with the canvas.
- The data layer has several areas where failure recovery, debounced persistence, snapshot contracts, and cross-table invariants should be made more explicit and tested.
- The production build has a large main JavaScript chunk. This is acceptable for a prototype but should be measured and split before broad distribution.

## Distribution and automatic-update architecture

This is the most important clarification for the requested “push once, update every installed device” behavior.

### What the desired workflow must become

```text
Developer change
    -> git push to GitHub
    -> GitHub Actions checks, builds, signs, and publishes installers/update artifacts
    -> GitHub Release or updater endpoint exposes the new version and signatures
    -> installed Parchment checks the updater endpoint
    -> user accepts (or policy permits) download/install/restart
```

A device cannot safely update by pulling the repository into the installed application. The installed app needs a platform-specific artifact, a monotonically newer application version, and a cryptographic signature that the app can verify. The source repository remains the development source of truth; GitHub Releases become the distribution/update source of truth.

Tauri supports platform installers and signed updater artifacts. On Windows, the supported user-facing choices should be an NSIS setup executable and/or MSI, rather than the current copied raw `.exe`. The official Tauri GitHub pipeline is the intended model: CI builds the platform artifact and uploads it to a GitHub Release, while the installed updater queries the release information.

### Recommended release channels

Use two channels so development pushes do not unexpectedly destabilize a writer’s daily application:

| Channel | Trigger | Audience | Update policy |
|---|---|---|---|
| Stable | A version tag such as `v0.2.0` | Normal installed users | Signed production update; release notes and rollback procedure required |
| Preview | Every successful push to `main` after a version bump or CI-generated prerelease version | Test devices and maintainers | Signed prerelease update; clearly labelled and opt-in |

If the product requirement is literally “every push updates every installed device,” a production channel can publish on every push as well, but every build must still have a distinct version. That policy is riskier because a broken commit could immediately reach every installation. The safer interpretation is that a push to the release branch should automatically produce a release, while stable installations update only from the stable channel.

### Required release components

1. **Application version authority**
   - Choose one source of truth for SemVer, then synchronize `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` as part of release automation.
   - Reject a release if the version is not greater than the last published version.
   - Decide how preview versions are represented, for example `0.2.0-beta.3` or a CI build number.

2. **Tauri updater integration**
   - Add the JavaScript updater package and the Rust updater plugin at compatible Tauri 2 versions.
   - Configure the updater endpoint and public verification key in Tauri configuration.
   - Generate the signing key once, store the private key only in GitHub Actions secrets, and commit only the public key/configuration.
   - Add a startup check that is non-blocking and does not delay opening a local project.
   - Add an explicit “Check for updates” action in Settings or the native Help/Application menu.
   - Show states for checking, no update, available, downloading, ready to install, installed/restarting, offline, failed, and signature-invalid.
   - Never overwrite the installed binary with an unsigned download.

3. **GitHub Actions release workflow**
   - Run typecheck, unit tests, frontend build, and Tauri build before publishing.
   - Build only supported target triples in the first release; expand the matrix after one platform is reliable.
   - Produce Windows installer artifacts first, then macOS and Linux artifacts when signing and platform testing are available.
   - Sign installers and updater bundles using GitHub Actions secrets.
   - Create/update GitHub Releases with installers, updater archives, signatures, checksums, and release notes.
   - Make the workflow fail closed if signing credentials are missing.
   - Avoid publishing artifacts from untrusted pull requests.
   - Use least-privilege permissions and pin third-party Actions to reviewed versions or commit SHAs where practical.

4. **Installer experience**
   - Make `npm run tauri:build` produce the supported installer, not just a raw executable.
   - Select a stable application identifier and preserve it forever after the first public release; changing it can create a second unrelated installation.
   - Add a clear product name, publisher, version, icon, license/about information, and installation directory behavior.
   - Decide whether the installer is per-user or machine-wide and document permissions accordingly.
   - Test install, launch, uninstall, reinstall, upgrade-over-existing-install, and update-after-user-data-exists.
   - Document where local data lives and confirm that uninstall does not unexpectedly delete project data.

5. **Update safety**
   - Update only after signature verification and artifact integrity verification.
   - Keep the current installation runnable until the new artifact is ready.
   - Handle interrupted downloads and restarts without corrupting IndexedDB.
   - Back up or validate the database before schema-changing releases.
   - If the new application cannot start, provide a documented rollback path through the previous GitHub Release/installer.
   - Separate application updates from user project backups; an update must never be presented as a backup.

### Distribution acceptance criteria

- A clean Windows machine can install Parchment from a published installer without Node, Rust, or a checkout of the repository.
- Launching the installed app opens the local-first application and preserves its data across restarts.
- A signed newer release appears in the app’s update UI, downloads, installs, and restarts successfully.
- A modified or unsigned artifact is rejected.
- A failed/offline update leaves the existing installation usable.
- A GitHub push can trigger the documented CI path without a developer manually copying binaries.
- Release notes identify user-visible changes and any migration or backup requirement.
- The process is reproducible from a fresh clone using documented repository secrets and GitHub settings.

## Roadmap at a glance

| Priority | Phase | Outcome |
|---|---|---|
| P0 | 0. Baseline and release decisions | A controlled delivery contract and measurable baseline |
| P0 | 1. Installer, signing, and automatic updates | Installable desktop app that can safely update from GitHub Releases |
| P0 | 2. Data integrity and recovery | Trustworthy autosave, snapshots, backup, migration, and failure handling |
| P1 | 3. Editor and writing workflow | Faster, clearer, more predictable long-form writing |
| P1 | 4. World-map interaction and visual overhaul | A map that feels deliberate rather than janky |
| P1 | 5. Planning and Codex integration | Planning surfaces that reinforce one shared project model |
| P1 | 6. UI, accessibility, and responsive polish | Consistent keyboard, focus, resize, and feedback behavior |
| P2 | 7. Assistant, spellcheck, and import/export hardening | Useful intelligent tools that fail gracefully and preserve meaning |
| P2 | 8. Performance, testing, and observability | Confidence at project scale and during releases |
| P2 | 9. Product operations and documentation | Sustainable releases, support, and future collaboration |

## Phase 0 — Establish the baseline and decisions

### Goals

Create a stable reference point before changing behavior. Make the release, storage, and visual decisions explicit so later work does not repeatedly reopen foundational questions.

### Work items

- Confirm the supported operating systems for the first public installer. Start with Windows because the current development and packaging path already targets it.
- Decide whether the first public desktop release is stable-only or includes a preview channel.
- Decide whether “automatic” means silent background installation or automatic download followed by a user-confirmed restart. Recommend download plus confirmation for a writing tool.
- Record the release branch, tag convention, versioning policy, and release-note format.
- Record the local data location, backup format, compatibility policy, and whether older app versions must be able to open newer backups.
- Capture baseline timings for cold launch, project open, first editor render, large-document typing, map interaction, backup export, and installer startup.
- Capture baseline bundle size and Tauri installer sizes.
- Add a short architecture decision record for updater endpoint, release channel, signing, and version ownership.
- Turn the relevant research statements in `CLAUDE.md` into links to source files and, where useful, tests.

### Exit criteria

- A maintainer can answer what gets released, to whom, from which branch, and how an installed device finds it.
- Baseline measurements are stored in a repeatable form.
- No implementation phase depends on an unrecorded decision about data location, update policy, or supported platforms.

## Phase 1 — Installer, release pipeline, and automatic updates

This phase is required before calling Parchment distributable.

### 1.1 Package the real application

- Replace the “copy the raw executable” mental model with the Tauri bundle as the supported distribution artifact.
- Keep `desktop:build` only as a developer convenience if it remains useful; make its name and documentation clear so nobody mistakes it for a release installer.
- Verify `bundle.active`, icons, publisher, identifier, copyright, descriptions, and target configuration.
- Add an installer smoke test that launches the installed binary and verifies the frontend loads.
- Confirm that native menu commands and filesystem permissions work from an installed location, not only from development.

### 1.2 Add signed updating

- Add the Tauri updater plugin on both sides of the bridge.
- Configure a release endpoint that returns the current version, platform-specific URLs, and signatures.
- Use the public key embedded in the application to verify downloaded update metadata/artifacts.
- Implement an `updateService` with a small state machine rather than scattering updater calls through Settings, menus, and startup code.
- Expose a browser-safe no-op or explanatory status when the frontend is running outside Tauri.
- Avoid checking every render or every route change. Use startup/interval policy with a manual override.
- Ensure update checks do not require opening a project or mutating Dexie state.

Suggested state model:

```text
idle
  -> checking
       -> unavailable | available
available
  -> downloading
       -> ready-to-install | failed
ready-to-install
  -> installing
       -> restarting | failed
```

### 1.3 Build and publish with GitHub Actions

- Add a workflow for pull requests that runs typecheck, tests, frontend build, and a non-publishing Tauri build where feasible.
- Add a stable release workflow triggered by `v*` tags.
- Add a preview workflow triggered by approved pushes to `main`, if preview updates are wanted.
- Build the Windows NSIS installer first. Add MSI only if it serves a real deployment need; each extra format increases test surface.
- Add macOS and Linux targets only after signing, packaging, and update behavior are verified on those operating systems.
- Publish artifacts to GitHub Releases, with checksums and release notes.
- Keep release creation atomic: do not mark a release ready for updater consumption until all required artifacts and signatures exist.
- Ensure the workflow does not accidentally publish on forks or pull requests.
- Add a CI job that confirms the generated updater manifest contains the expected version and all supported targets.

### 1.4 Design the update UX

- Add a Settings row showing current version, update channel, last check time, and a manual check action.
- Add a non-intrusive startup notification for an available stable update.
- Explain what will happen to unsaved work before restart; flush editor persistence before installation.
- Let users defer an update and avoid repeated nagging during the same session.
- Show release notes before confirmation when practical.
- Make update failures actionable without exposing internal stack traces to normal users.
- Add a “copy diagnostic details” path for support, excluding project content and secrets.

### Phase 1 technical tests

- Unit-test endpoint parsing, platform selection, version comparison, channel selection, and updater state transitions.
- Test update checks from the browser build and Tauri build separately.
- Test that a lower/equal version is not offered as an update unless an explicit rollback mode exists.
- Test signature-invalid, missing-artifact, offline, timeout, and interrupted-download paths.
- Run an end-to-end upgrade from the previous version with a fixture project containing nodes, snapshots, Codex entries, map geometry, and settings.
- Test installer and updater behavior on a clean machine and on a machine with an existing installation.

## Phase 2 — Data integrity, persistence, and recovery

Parchment’s local-first promise is only credible if saving and recovery are observable and conservative.

### 2.1 Make autosave explicit and reliable

- Centralize editor persistence into one service with clear ownership of debounce, flush, and error state.
- Track `dirty`, `saving`, `saved`, and `saveError` instead of relying only on a timer.
- Flush pending editor content on explicit save, route change, project close, visibility change, and before an application update restart.
- Ensure unmount cleanup flushes or cancels timers deterministically.
- Keep editor identity tied to node identity so switching documents cannot write one document’s pending content into another.
- Verify the saved content hash or updated timestamp when useful for diagnostics.
- Make the current save status visible without turning the editor into a noisy dashboard.

### 2.2 Strengthen snapshot semantics

- Define the snapshot contract: title, body/content, text, word count, timestamp, source (`manual`, `automatic`, `before-restore`), and node ID.
- Make automatic snapshot retention and manual snapshot retention explicit rather than relying on incidental ordering.
- Ensure restoring a snapshot creates a recoverable pre-restore snapshot before replacing current content.
- Reload the editor from the restored node through the existing store path and verify cursor/selection behavior.
- Add compare behavior that handles empty, very large, and malformed historical content.
- Never delete the only recovery path for a node as a side effect of ordinary cleanup.

### 2.3 Make backup and import safer

- Add a backup schema version and a validation layer before import writes anything.
- Validate required IDs, references, dates, enum values, and content shape.
- Make import transactional or staged: parse, validate, preview counts/conflicts, then commit.
- Make ID remapping complete for parent links, scene links, thread references, snapshots, Codex relationships, regions, markers, and map `locationId` values.
- Provide a readable import error with the failing section and field.
- Add a backup verification command that can inspect a file without importing it.
- Document whether a backup contains settings, dictionaries, and external assets.
- Add optional automatic backup before destructive bulk imports or schema migrations.

### 2.4 Harden database migrations

- Test each existing schema version upgrade from a fixture database.
- Separate migration logic from application startup so it can be tested without rendering React.
- Log migration outcome and preserve a pre-migration backup when the migration changes user data.
- Define behavior when a future-version backup is opened by an older app.
- Add integrity checks for orphaned nodes, missing parent nodes, invalid sibling orders, dangling Codex links, and map marker/region references.
- Use a repair report instead of silently “fixing” data without telling the user.

### Exit criteria

- A forced close during an editor save does not silently lose the latest confirmed content.
- Restore, duplicate, move, merge, archive, trash, and import operations have fixture-based tests.
- A full backup can be exported, validated, imported into a clean database, and compared by meaningful entity counts and references.
- Application updates do not corrupt or relocate project data.

## Phase 3 — Editor and writing workflow

### 3.1 Editing correctness

- Audit every toolbar command for selection preservation and TipTap transaction consistency.
- Make clear-formatting behavior explicit: preserve or remove links, comments, annotations, and custom marks by documented policy.
- Verify keyboard shortcuts on Windows, macOS, and browser contexts.
- Ensure word count and character count agree with the product’s documented definition, especially around punctuation, Unicode, em dashes, apostrophes, and non-Latin scripts.
- Improve paste normalization for rich text, plain text, DOCX-derived HTML, and malformed HTML.
- Add a visible recovery path when TipTap content fails to parse.
- Preserve editor focus when opening contextual controls and return focus after closing them.

### 3.2 Long-document performance

- Measure editor render and save time with 10k, 50k, and 100k-word fixtures.
- Avoid recomputing full document text on every keystroke where a transaction-level delta is enough.
- Defer expensive spellcheck and analysis work while the user is typing.
- Split large UI/editor bundles at route or feature boundaries where it improves cold start.
- Avoid rendering hidden planning surfaces when they are not active.

### 3.3 Writing modes and focus

- Define the visual and behavioral contract for focused, distraction-free, and typewriter modes.
- Ensure side panels do not cause unexpected scroll jumps or change the editor’s writing width without clear feedback.
- Make the minimum Tauri window size sufficient for the supported default layout, or make narrow layouts deliberately responsive.
- Add reduced-motion behavior for panel transitions and editor affordances.
- Ensure zoom and font-size changes do not break toolbar overflow, selection, or page boundaries.

## Phase 4 — World-map interaction and visual overhaul

The map needs a visual and interaction pass, not merely more features. The objective is a map that communicates what is selectable, draggable, editable, saved, and linked while maintaining stable geometry.

### 4.1 Establish a map coordinate contract

- Keep geometry in map coordinates and make the map-to-screen transform a named, tested abstraction.
- Define whether all map elements use `x/y`, `cx/cy`, or another canonical representation; convert only at boundaries.
- Use one hit-test transform for regions, markers, labels, cut strokes, and selection handles.
- Add tests for zoom, pan, device pixel ratio, resize, and export coordinate equivalence.
- Define minimum/maximum zoom and a modest overscroll policy.

### 4.2 Fix camera behavior first

- Clamp pan so the map cannot be dragged permanently outside the viewport.
- Preserve a small intentional overscroll if it helps touch/pointer interaction, but always provide a reliable “Fit map” recovery.
- Anchor zoom around the pointer or selected content rather than always around the viewport center.
- Make fit-to-map account for toolbar, legend, inspector, and safe overlay insets.
- Recalculate the camera on resize without changing the map’s logical geometry.
- Show a subtle zoom/pan status only when it helps orientation.

### 4.3 Make selection and manipulation legible

- Distinguish select mode from pan mode in the toolbar and cursor.
- In select mode, clicking empty space should have a predictable meaning; do not make empty clicks unexpectedly pan unless the mode communicates it.
- Give selected regions a clear fill/outline treatment that survives dark/light themes.
- Provide visible drag handles or a deliberate selected-state affordance for editable objects.
- Show the active tool, selected object, and unsaved state in a compact status treatment.
- Support Escape to cancel an in-progress gesture and a consistent Delete/Backspace policy with confirmation for destructive region deletion.
- Add keyboard navigation for selected markers/regions where feasible.

### 4.4 Replace fragile freehand geometry

- Resample pointer input by distance along the stroke, not by event count, so fast and slow drawing produce comparable geometry.
- Simplify noisy paths with a tolerance tied to map scale and pointer precision.
- Preserve deliberate corners while reducing high-frequency jitter.
- Replace the current tension-heavy smoothing path with a bounded spline or corner-aware smoothing strategy that does not overshoot the drawn landmass.
- Add tests proving that smoothing does not create self-intersections or excursions beyond a documented tolerance.
- Keep the original raw stroke long enough for undo/re-edit or store it as optional provenance.

### 4.5 Make cut semantics match the visible stroke

- Treat cut mode as a geometric operation, not as a visual line followed by a rough heuristic.
- Compute actual intersections between the cut polyline and the region boundary.
- Define behavior for one intersection, two intersections, tangent contact, a cut fully inside a region, a cut outside all regions, and a cut crossing multiple regions.
- If a valid cut requires a closed partition path, show the closure or explain it in the tool affordance.
- Reject ambiguous cuts without changing data and provide a concise reason.
- Preserve continuity at cut endpoints and retain sensible winding/order for both output regions.
- Add fixture-based geometry tests for convex, concave, narrow, island-like, and self-near regions.

### 4.6 Add proper reshape/edit tools

- Allow a selected region to enter vertex-edit mode.
- Support moving, inserting, deleting, and snapping vertices with a visible outline.
- Keep a raw/normalized representation if undo and future editing benefit from it.
- Add region split/merge only after cut and vertex invariants are stable.
- Validate polygon output before persistence and reject invalid self-intersecting geometry.
- Make undo/redo cover geometry, markers, colors, map dimensions, background, and metadata consistently.

### 4.7 Improve labels, markers, and visual hierarchy

- Replace arithmetic centroids with a visual label anchor strategy that prefers an interior point with usable clear space.
- Keep labels inside their region where possible; provide manual label repositioning when automatic placement is not enough.
- Scale marker icons and labels in screen space or define a clear map-space scale policy so zoom does not make them unusable.
- Add decluttering rules for overlapping labels and markers.
- Make marker type, selection state, and linked Codex location visually distinguishable without relying only on color.
- Expose the existing `locationId` relationship in the map inspector and provide a path to create/open the linked location.
- Keep region, marker, label, and outliner ordering synchronized.

### 4.8 Rebalance the map layout

- Treat the legend and inspector as responsive surfaces rather than permanently competing fixed panels.
- Allow the inspector to collapse, dock, or open as a sheet on narrow windows.
- Move map controls into a visually coherent toolbar with clear grouping: camera, draw/edit, selection, history, export.
- Ensure controls meet pointer target sizing and have tooltips/keyboard access.
- Use a stable map background, region palette, selection color, and shadow language that matches the surrounding Parchment chrome.
- Avoid relying on a visually heavy paper shadow when it reduces map contrast or wastes the small viewport.
- Test 880×600, 1280×832, and a large desktop viewport with the legend and inspector both open.

### 4.9 Save and history behavior

- Flush map changes on pointer-up, tool change, route change, unmount, visibility change, and application update preparation.
- Give map changes the same dirty/saving/error language as editor changes.
- Make undo/redo snapshots include every user-visible map property that the action can change.
- Preserve map state if the user switches between Lore and Map while a debounce is pending.
- Add a recovery action for a failed map save.

### Map exit criteria

- A user can draw a region at different pointer speeds and obtain stable, bounded geometry.
- A cut either produces a valid, visually matching result or refuses without data loss.
- The map can always be brought back into view.
- Selected objects, active tools, labels, markers, and overlays are visually obvious at all supported sizes.
- Map edits survive navigation and application restart.
- PNG/SVG exports represent the same logical geometry and expected visual ordering as the editor.
- A user can connect a map marker to a Codex location and navigate between them.

## Phase 5 — Planning and Codex integration

### Shared project graph

- Define the relationships among binder nodes, scenes, characters, locations, plot threads, world elements, regions, markers, and snapshots.
- Add stable relationship helpers rather than duplicating filtering logic in every panel.
- Make dangling-reference behavior explicit after delete, duplicate, merge, import, and restore.
- Add a project-level “integrity” view that reports unresolved links without blocking ordinary writing.

### Outline and corkboard

- Make drag/reorder affordances visible before hover and usable with keyboard alternatives.
- Provide an insertion indicator and clear destination feedback during drag.
- Explain the difference between reordering, reparenting, and moving between scenes.
- Ensure cards update immediately after edits and remain consistent with the Binder.
- Add empty states that teach the user what to do next.

### Timeline and story structure

- Define how relative dates, explicit dates, unknown dates, and conflicting dates are represented.
- Add a stable sort policy and explain it visually.
- Show the source node and relevant Codex links from timeline entries.
- Make the timeline usable without requiring every scene to have a date.

### Codex

- Standardize create/edit/delete form behavior, validation, and unsaved-change handling across characters, locations, threads, and world elements.
- Add search and filtering when entity counts become large.
- Make related nodes and map markers discoverable.
- Add relationship summaries without turning the Codex into an opaque graph-only interface.
- Preserve details, rules, aliases, and notes through import/export.

## Phase 6 — UI, accessibility, and responsive polish

### Global shell

- Establish a small set of layout primitives for top bars, side rails, panels, tabs, overlays, and status areas.
- Standardize panel width, border, radius, shadow, muted text, focus ring, and selected-state tokens.
- Audit all light/dark themes for contrast and semantic color meaning.
- Remove or fix placeholder controls, especially controls that look interactive but have no action.

### Keyboard and focus

- Add a documented keyboard map for navigation, save, search, new document, mode switching, undo/redo, and map actions.
- Ensure every dialog traps focus, returns focus to its opener, closes through Escape where appropriate, and exposes an accessible name.
- Audit menus, segmented controls, tabs, popovers, tooltips, and drag alternatives for keyboard access.
- Avoid using title attributes as the only explanation for important controls.
- Make focus visible in all themes and on dark map surfaces.

### Responsive behavior

- Test at the configured minimum Tauri window size and at browser widths below it.
- Define which surfaces collapse, stack, scroll, or become modal sheets.
- Prevent fixed overlays from covering editor controls or map content.
- Ensure long titles, long Codex names, and large numbers do not break horizontal layouts.
- Add resize-aware tests or visual snapshots for key shell states.

### Feedback and errors

- Give every asynchronous mutation a pending/success/failure path.
- Replace silent `console.error`-only failures with user-safe messages and a diagnostic path.
- Add an ErrorBoundary recovery screen that can reload the current route without losing persisted content.
- Distinguish “no data,” “loading,” “empty by choice,” and “failed to load.”
- Keep notifications short and non-blocking for normal saves; reserve dialogs for destructive or consequential actions.

## Phase 7 — Assistant, spellcheck, and import/export hardening

### Story Assistant

- Define the privacy boundary for local analysis, provider-backed analysis, and any future hosted service.
- Never send project text to a provider without explicit configuration and user action.
- Show exactly which scenes/characters/locations were included in an analysis.
- Make provider errors, rate limits, malformed responses, and partial results recoverable.
- Validate structured advanced-analysis responses before rendering them.
- Add cancellation for long-running analysis and prevent stale results from replacing newer project state.
- Keep local heuristics useful when no provider is configured.

### Spellcheck

- Make language-pack loading state visible and recoverable.
- Keep the current language consistent between editor decorations and Settings.
- Handle words containing apostrophes, hyphens, Unicode combining marks, and markup boundaries.
- Avoid rescanning the whole document more often than necessary.
- Test add-to-dictionary and ignore behavior across reloads and projects.
- Document dictionary storage and backup behavior.

### Import/export

- Establish a round-trip test matrix for Markdown, TXT, DOCX, ePub, project export, full backup, and Tauri native file paths.
- Define chapter splitting rules for ePub and long-form exports.
- Preserve headings, emphasis, links, colors, highlights, alignment, and deliberate empty paragraphs according to format capability.
- Add export progress for large projects.
- Use safe filenames and prevent accidental overwrite without confirmation.
- Verify browser and Tauri export paths produce equivalent content.

## Phase 8 — Performance, testing, and observability

### Test layers

- Keep fast unit tests for domain helpers, migrations, backup validation, versioning, updater parsing, and map geometry.
- Add repository integration tests for multi-table transactions and cross-entity ID remapping.
- Add component tests for editor save state, snapshots, dialogs, Binder interactions, map modes, and update UI.
- Add browser end-to-end tests for create project → write → save → reopen → export.
- Add desktop smoke tests for installer launch, native menu, native dialog, single instance, and updater state.
- Add fixture projects that represent realistic sizes rather than only empty starter data.

### Performance work

- Split the main bundle by route/feature where measured cold-start benefit justifies the complexity.
- Lazy-load advanced assistant, import/export format handlers, dictionaries, and map export code where possible.
- Measure Dexie query count and React render count while typing and navigating.
- Avoid loading every project’s complete content on the Dashboard.
- Keep map pointermove handlers free of synchronous database writes and expensive React-wide state updates.
- Add memory checks for large documents, large maps, backups, and repeated project switching.

### Observability without violating local-first privacy

- Default to no remote telemetry containing project content.
- Add local diagnostic logging with bounded retention and a user-controlled export.
- If anonymous telemetry is ever introduced, make it opt-in or clearly configurable and document the fields.
- Record release/update failures in a privacy-safe form that helps distinguish endpoint, signature, download, install, and restart failures.
- Add a version/build identifier to diagnostics so reports can be reproduced.

## Phase 9 — Product operations and documentation

- Maintain `CLAUDE.md` as architecture/context documentation and `ROADMAP.md` as prioritized delivery intent.
- Add a concise `CONTRIBUTING.md` describing local setup, tests, branch rules, and release conventions.
- Add a release runbook covering version bump, tag, CI, signing secrets, GitHub Release validation, smoke testing, and rollback.
- Add an installer/update troubleshooting guide for users.
- Publish a changelog with migration notes and known issues.
- Add screenshots or short recordings for the main workflows once the interface stabilizes.
- Define support categories: data recovery, installer/update, editor, map, import/export, assistant, and accessibility.
- Review dependency updates regularly, especially Tauri, Rust, TipTap, Vite, and updater packages.
- Keep native permissions and the Tauri CSP under review as integrations grow.

## Suggested implementation order

The following sequence minimizes rework:

1. Add a clean CI quality gate and capture the current baseline.
2. Decide release channels and version authority.
3. Convert the desktop build into a real signed installer workflow.
4. Integrate the Tauri updater and a non-blocking update UI.
5. Add installer/update upgrade tests using a fixture project.
6. Harden autosave, snapshot flushes, backup validation, and migrations.
7. Add cross-entity integrity tests and repair reporting.
8. Improve editor correctness and large-document performance.
9. Rework map camera, coordinate transforms, freehand sampling, smoothing, and cut geometry.
10. Rework map overlay layout, labels, marker linkage, and responsive states.
11. Polish planning/Codex relationships and shared empty/loading/error states.
12. Complete accessibility and responsive audits.
13. Harden assistant, spellcheck, and format round trips.
14. Split measured performance bottlenecks and add desktop end-to-end coverage.
15. Publish a stable release with installer documentation, changelog, and rollback instructions.

## Definition of done for a public release

### Engineering

- `npm run typecheck` passes.
- `npm test -- --run` passes.
- `npm run build` passes.
- Tauri installer builds for every promised target.
- Release artifacts are signed and their signatures are verified by a clean installed copy.
- No release contains credentials or private signing material.

### Data

- Create, edit, save, close, reopen, duplicate, move, merge, archive, trash, restore, import, export, and update flows have been exercised with a non-trivial fixture project.
- A backup can be validated and restored.
- A failed save or update does not silently erase the current project.
- Schema migration has a tested path and a documented rollback/backup story.

### Interface

- Core writing flow works at the minimum supported window.
- Loading, empty, saving, saved, error, and disabled states are visible and understandable.
- Keyboard users can navigate the core shell, editor actions, dialogs, Binder, planning surfaces, and map controls.
- Focus rings and color contrast remain usable in every supported theme.
- Map camera recovery, selection, drawing, cut, undo/redo, overlays, labels, markers, and export have been tested at multiple zoom levels.

### Operations

- A maintainer can push/tag a change and understand exactly what CI produced.
- An installed stable device can receive the next signed stable release without a manual reinstall.
- A preview device can opt into preview updates without forcing previews on stable users.
- Release notes and known limitations are published with the artifacts.

## Risks and decisions to revisit

### Automatic updates versus stability

Publishing every commit to every user satisfies the strongest interpretation of the request but makes every commit a production release. Use preview updates for every main-branch build and stable updates for tagged releases unless there is a deliberate decision to accept that risk.

### Tauri updater versus operating-system stores

The GitHub Release updater is the shortest path for a self-distributed desktop app. Microsoft Store, Mac App Store, Flathub, or enterprise deployment may impose separate update systems and signing requirements later. Do not design the first pipeline around store behavior unless distribution plans require it.

### Local data and multi-device use

Automatic application updates do not synchronize projects between devices. If multi-device project synchronization is later needed, it must be designed as a separate data-sync product with conflict resolution and an explicit privacy model.

### Provider-backed AI

Advanced analysis can be useful, but it creates privacy, cost, network, and failure-mode concerns that do not apply to local heuristics. Keep the provider boundary explicit and optional.

### Map geometry scope

Robust polygon editing and splitting can become a substantial geometry subsystem. Prefer a small, well-tested geometry kernel or a carefully evaluated dependency over growing ad hoc heuristics inside React event handlers.

## Claude implementation prompt

Copy the prompt below into Claude when you want implementation to begin. It deliberately starts with release safety and data protection, then proceeds through the product roadmap.

```text
You are taking over implementation of the Parchment repository:
https://github.com/contact773/parchment

Read these files before changing anything:

1. ROADMAP.md — the prioritized implementation roadmap and release/update requirements.
2. CLAUDE.md — the full architecture, function catalogue, interface analysis, risks, and world-map visual analysis.
3. package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/src/main.rs, and the relevant source files referenced by those documents.

Current product context:

- Parchment is a local-first React/Vite/TypeScript writing studio running in a Tauri 2 desktop shell.
- Its persisted data is in Dexie/IndexedDB and includes projects, Binder nodes, characters, locations, plot threads, snapshots, world elements, maps, regions, and markers.
- It has an editor, planning surfaces, Codex, snapshots, import/export, spellcheck, Story Assistant, and a freehand world map.
- The repository currently has Tauri bundling metadata but no completed signed installer/update pipeline.
- The current desktop:build convenience script copies a raw executable; that is not the user-facing installer.
- Do not treat stale audit files as proof of current behavior. Verify claims against the current source.

Primary delivery requirement:

Parchment must be installable through a proper platform installer. When a new approved release is pushed to GitHub, installed copies must be able to discover, verify, download, and install the update without the user manually reinstalling the application.

Important technical interpretation:

- A raw git push cannot update installed binaries by itself.
- Implement the Tauri updater using signed artifacts published by GitHub Actions to GitHub Releases or the configured updater endpoint.
- Never put an updater private signing key, provider API key, or other secret in the repository.
- Prefer stable updates from version tags and an opt-in preview channel for main-branch builds. If you choose a different policy, document the safety tradeoff.
- Use versioned artifacts. Every published update must have a strictly newer version than the installed version.
- Updates must be non-blocking on startup, must not require opening a project, and must not risk losing unsaved editor or map changes.

How to work:

1. Inspect the repository and git state first. Do not overwrite unrelated working-tree changes.
2. Turn the roadmap into small, reviewable phases. Start with the CI quality gate, versioning decision, installer, signing configuration, updater service, release workflow, and update tests.
3. Use official Tauri 2 updater/distribution patterns. Keep browser mode working with a safe no-op or browser-specific status.
4. Build a clear updater state machine and user-facing Settings/menu entry. Cover checking, no update, available, downloading, ready, installing, offline, signature failure, timeout, and recovery.
5. Add tests before or alongside behavior changes. At minimum cover version comparison, release metadata parsing, platform selection, updater state transitions, installer/release configuration, and the existing project fixture through an upgrade.
6. Treat Dexie data as user data. Before update restart, flush pending editor/map writes. Do not change the schema without migrations, backup/recovery behavior, and tests.
7. After the release pipeline is safe, proceed through the remaining roadmap phases in order: persistence/recovery, editor quality, world-map geometry and visual UX, planning/Codex integration, accessibility/responsive polish, assistant/spellcheck/import-export hardening, then performance and operations.
8. For the world map, address camera bounds, pointer-speed-independent sampling, bounded smoothing, true cut intersections, valid polygon output, undo coverage, label anchors, marker scaling/linkage, overlay layout, and map save flushing before adding decorative features.
9. Preserve existing working behavior unless the roadmap explicitly calls for a change. When behavior is ambiguous, choose the least destructive option and document the decision.
10. Use `apply_patch` or equivalent reviewable edits. Do not commit generated build output, local databases, secrets, or machine-specific files.
11. After each meaningful phase, run the relevant checks. At minimum run:
    - npm run typecheck
    - npm test -- --run
    - npm run build
    - npm run tauri:build when native packaging changes
12. Report what changed, what was verified, what remains unverified, and any GitHub repository secrets or settings that a maintainer must configure manually.

Release workflow expectations:

- Pull requests: quality checks and, where practical, a non-publishing build.
- Stable tags such as v0.2.0: signed installer/update artifacts, GitHub Release, release notes, and smoke-test gate.
- Optional main-branch preview builds: clearly marked prereleases and opt-in updater channel.
- The release job must fail closed if signing secrets are absent.
- The repository must document the exact version-bump/tag/publish process and rollback procedure.

Do not silently broaden scope into cloud synchronization, account systems, or remote storage. Those are separate product decisions. Keep Parchment local-first and make release/update behavior safe, observable, and testable.
```

## Reference documentation for the release implementation

- [Tauri distribution documentation](https://v2.tauri.app/distribute/)
- [Tauri Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri GitHub pipeline and updater guidance](https://v2.tauri.app/es/distribute/pipelines/github/)
- [GitHub Actions release automation documentation](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions)

