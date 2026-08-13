# Parchment — Project Context and Research Notes

> Generated from a repository-wide static audit on 2026-08-13. This file is a
> context and maintenance guide, not an implementation change. It describes
> the code that is present in the workspace, the intended product model, the
> current interface, and the most important risks—especially in the world map.

## 1. Executive summary

Parchment is a local-first writing studio for novels, short stories, poetry,
screenplays, stage plays, television episodes, essay collections, general
manuscripts, and worldbuilding bibles. The frontend is a React 18 + TypeScript
application built with Vite. It runs in a normal browser or inside a Tauri 2
desktop shell. Manuscript content and planning data live in IndexedDB through
Dexie; small settings and UI preferences live in Zustand-backed localStorage.

The application is deliberately single-writer and offline-oriented. Its main
experience is a three-column workspace:

```text
Topbar
├── Left sidebar: project identity, Binder tree, navigation, writing goals
├── Center: editor or planning surface
└── Right panel: Inspector, Assistant, Notes, History
```

The strongest architectural idea is the separation between:

- `Project`, which contains metadata and a target;
- `TreeNode`, which is the manuscript/research/notes tree and stores TipTap JSON;
- codex tables (`Character`, `Location`, `PlotThread`, `WorldElement`);
- `WorldMap`, which stores map geometry and markers independently of codex
  locations; and
- `Settings`/UI state, which intentionally does not use Dexie.

The product is already broad for a v0.1: rich text, script formatting,
spellcheck, heuristic and provider-backed story assistance, planning boards,
world lore, a freehand SVG map editor, snapshots, imports, exports, themes,
Tauri native file dialogs, and sample projects.

The most significant current quality concern is not a missing feature in the
map; it is geometric interaction quality. The map is functional, but its
freehand-to-spline pipeline, infinite-canvas behavior, fixed-size SVG labels,
and half-plane cut model can make the result feel loose or janky. The details
and a prioritized remediation plan are in [World map visual analysis](#15-world-map-visual-analysis).

## 2. How to run and verify

Requirements are Node/npm for the web app and Rust/Tauri prerequisites for the
desktop build. The checked-in scripts are:

| Command | Purpose |
|---|---|
| `npm run dev` | Vite development server on port 5173 by default. Runs dictionary copying first. |
| `npm run build` | TypeScript build followed by Vite production build. Also copies Hunspell dictionaries. |
| `npm run typecheck` | `tsc -b --noEmit`. |
| `npm test` | Vitest run. Current repository has one story-assistant accuracy test file. |
| `npm run preview` | Serve the production `dist/` build. |
| `npm run dict` | Copy `.aff` and `.dic` files to ignored `public/dictionaries/`. |
| `npm run tauri:dev` | Run the frontend in the Tauri shell. |
| `npm run tauri:build` | Build the Windows NSIS installer plus signed updater artifacts. This is the distribution path. |
| `npm run desktop:build` | Developer convenience only: build without bundling and copy the raw binary to `Parchment.exe`. Not an installer. |
| `npm run version:check` | Fail if `package.json`, `tauri.conf.json` and `Cargo.toml` disagree. CI gate. |
| `npm run version:set -- <v>` | Bump the version everywhere; refuses anything not strictly newer. |
| `npm run version:sync` | Copy `package.json`'s version outward. |
| `npm run updater:keygen` | Create the updater signing key pair outside the repository. |
| `npm run release:verify -- --manifest latest.json …` | Validate a release manifest before it is published. |

Repository verification performed during this audit:

- `npm run typecheck` passed.
- `npm test -- --run` passed: 1 file, 1 test.
- `npm run build` passed. Vite reports a large main chunk (`index` is about
  1.08 MB minified, about 338 kB gzip) and recommends code splitting.
- The working tree already contained a user modification to `vite.config.ts`.
  It was preserved. No source file was changed by this audit.

## 3. Repository map

```text
src/
  main.tsx                         Browser entry; fonts, CSS, HashRouter
  App.tsx                          Routes, theme bootstrap, migration, global overlays
  index.css                        Tailwind layers, theme tokens, editor/map-adjacent styling
  types/index.ts                   Shared domain model
  data/db.ts                       Dexie schema and database instance
  data/repo.ts                     All primary IndexedDB CRUD and tree operations
  data/seed.ts                     First-run sample projects
  store/useSettings.ts             Persisted settings, themes, dictionaries, writing stats
  store/useUI.ts                   Persisted layout/session preferences and transient UI state
  hooks/useApplyTheme.ts           Applies settings to CSS variables/data attributes
  lib/                             Text, tree, formatting, IDs, desktop and class utilities
  components/                      Reusable shell/UI components
  pages/                           Dashboard, Workspace, Settings, Help
  features/editor/                 TipTap editor and editor affordances
  features/projects/               Binder and new-project flow
  features/planning/               Codex, boards, timeline, snapshots, world map
  features/spellcheck/             nspell/Hunspell bridge and decorations
  features/story-assistant/        Local analysis, AI providers, chat and transforms
  features/themes/                 Built-in themes, theme application and builder
  features/export/                 Block model, exporters, backup and imports
  features/updates/                Update state machine, service, Settings panel, notice

src-tauri/
  src/main.rs                      Tauri commands, native menu, plugins, single instance
  tauri.conf.json                  Window/build/bundle/updater configuration
  tauri.preview.conf.json          Build-time overlay: preview-channel endpoint
  tauri.ci.conf.json               Build-time overlay: no updater artifacts (unsigned CI builds)
  capabilities/default.json        Tauri permissions
  Cargo.toml                       Rust dependencies and release profile

public/parchment.svg               Favicon/branding
scripts/copy-dictionaries.mjs      Static Hunspell asset preparation
scripts/place-exe.mjs              Copies release binary to repository root
scripts/version.mjs                Version authority: print/check/sync/set/preview
scripts/updater-keygen.mjs         Generates the signing key pair outside the repo
scripts/verify-release.mjs         Validates a release manifest before publication
.github/workflows/ci.yml           Quality gate + unsigned installer build
.github/workflows/release.yml      Tag-driven signed release, published after verification
.github/workflows/preview.yml      Opt-in signed prerelease on the rolling `preview` tag
docs/RESEARCH.md                   Product discovery and design imperatives
docs/RELEASE.md                    Release runbook, secrets and rollback
docs/INSTALL.md                    Writer-facing install/update guide
docs/adr/0001-…                    Release channels, version authority, update safety
README.md                          Product/architecture overview
CONTRIBUTING.md                    Setup, checks, conventions, branch/release rules
CHANGELOG.md                       User-visible changes per release
```

`dist/` and `node_modules/` are generated/dependency directories. The
dictionary output under `public/dictionaries/` is intentionally ignored and is
recreated by the predev/prebuild hooks.

## 4. Runtime boot and routing

### `src/main.tsx`

The entry imports self-hosted Inter, Lora, Source Serif 4, and JetBrains Mono
font faces, then imports `index.css`. It mounts React under `StrictMode`, wraps
the app in `HashRouter`, and renders `App` into `#root`.

### `src/App.tsx`

`App()` performs two global tasks:

1. calls `useApplyTheme()` so CSS variables and dark mode are live before the
   user interacts with the app;
2. runs `migrateChapterContentToScenes()` once from an effect.

Routes:

- `/` → `Dashboard`;
- `/project/:projectId` → `Workspace`;
- `/settings` → `SettingsPage`;
- `/help` → `HelpPage`;
- any unknown path redirects to `/`.

`ErrorBoundary`, `Toaster`, and `ConfirmRoot` are mounted globally. The
boundary catches render errors, displays a stack excerpt, offers a retry, and
sets the hash back to the dashboard.

## 5. Domain model and persistence

### Project model

`ProjectType` values are `novel`, `short-story`, `poetry`, `screenplay`,
`stage-play`, `tv-episode`, `series`, `essay-collection`, `worldbuilding`, and
`manuscript`. `ProjectStatus` is `planning`, `drafting`, `revising`, `final`,
or `archived`. `Project` stores title, author, language, genre, logline,
description/subtitle slots, target words, color, default document type,
deadline, pin state, tags, soft-delete timestamp, creation/update times, and
last-opened time.

The `PROJECT_TYPES` table in `lib/constants.ts` supplies label, icon name,
default `DocType`, description, and starter-structure hint. `defaultTarget()`
in `repo.ts` supplies format defaults such as 80,000 words for novels, 22,000
for screenplays, 9,000 for TV episodes, and zero for poetry/worldbuilding.

### Binder and document model

`NodeType` distinguishes containers (`folder`, `part`, `chapter`) from writable
documents (`scene`, `section`, `note`, `research`). `DocType` is `prose`,
`script`, or `poetry`. `TreeNode` stores parent ID, sibling order, collapsed
state, synopsis, status, metadata, TipTap `content`, plain-text mirror, word
count, tags, pin state, soft-delete state, and timestamps.

`SceneMeta` supports POV, goal, conflict, outcome, beat label, target words,
compile inclusion, in-world date/time, location ID, character IDs, and a
per-document language override. Containers are not intended to contain prose;
legacy chapter content is migrated into a new scene.

### Codex and worldbuilding model

- `Character` has role, aliases, summary, goal, motivation, conflict, arc,
  appearance, backstory, voice, notes, color, and relationship edges.
- `Location` has kind, description, atmosphere, significance, notes, color,
  and order.
- `WorldElement` is a lore-bible entry with category, summary, details, rules,
  color, and order.
- `PlotThread` has status, description, color, and `sceneIds`.
- `WorldMap` has dimensions, ocean/background color, map regions, map markers,
  and timestamps. It is not a graph of `Location` records; the marker type has
  an optional `locationId`, but the current map UI does not expose that link.

Map geometry is stored in map coordinates. The initial map is `1000 × 640`,
with `#cfe3ef` background. `MapRegion.points` are polygon vertices. Regions
default to `continent` and may be switched to `country`; markers default to
`city` and may be switched to `place`.

### Dexie schema (`src/data/db.ts`)

Database name: `parchment`.

- Version 1: projects, nodes, characters, locations, threads, snapshots.
- Version 2: worldElements.
- Version 3: maps.

Indexes include IDs, project IDs, update/order timestamps, status/type, and the
`[projectId+parentId]` compound index on nodes. Several operations still filter
in JavaScript because IndexedDB does not index null keys cleanly.

`db` is a singleton `ParchmentDB` instance. Large, frequently edited content is
kept here rather than in Zustand.

## 6. Data/repository function catalogue

`src/data/repo.ts` is the application’s domain-service layer. Components should
use these functions rather than accessing tables directly for mutations.

### Shared helpers

- `now()` — local timestamp helper.
- `emptyDoc()` — returns a one-paragraph TipTap document.
- `isContainer(type)` — identifies folder/part/chapter.
- `isDocument(node)` — inverse of container classification.

### Projects

- `createProject(input)` — constructs a project, derives its default document
  type/target, inserts it, and creates a type-specific starter tree.
- `defaultTarget(type)` — maps project format to a target word count.
- `updateProject(id, patch)` — partial update plus `updatedAt`.
- `touchProject(id)` — updates `lastOpenedAt`.
- `deleteProject(id)` — permanently deletes the project and all dependent
  nodes, codex rows, snapshots, world elements, and maps in one transaction.
- `archiveProject(id, archived)` — sets archived or, when unarchiving, resets
  the status to `drafting`; this does not preserve an arbitrary prior status.
- `duplicateProject(id)` — copies the project and every dependent table. Node
  IDs are remapped while parent IDs, thread scene links, and snapshot node IDs
  are remapped. Character/location/world/map internal IDs are copied as new
  IDs, but cross-table links beyond node/thread links are not comprehensively
  remapped.
- `projectWordCount(projectId)` — sums live, included document nodes.

### Binder/node operations

- `nextOrder(projectId, parentId)` — scans project siblings and returns the next
  order value.
- `createNode(input)` — creates a container or document, assigns defaults,
  computes text/count for initial content, and touches the project.
- `defaultTitle(type)` — default labels for new node types.
- `numberToWords(n)` / `wordToNumber(s)` — private chapter-number helpers for
  values below 100.
- `nextChapterTitle(projectId)` — reads current `Chapter One`/`Chapter 1`
  conventions and creates the next title.
- `updateNode(id, patch)` — partial node update with timestamp.
- `saveNodeContent(id, content)` — converts TipTap JSON to text, counts words,
  stores content/text/count, and updates the project timestamp.
- `renameNode(id, title)` — title-only update.
- `collectSubtree(rootId, all)` — private iterative descendant collection.
- `deleteNode(id)` — soft-deletes a node and all descendants.
- `restoreNode(id)` — restores a subtree and any trashed ancestors needed to
  avoid orphaning it.
- `hardDeleteNode(id)` — permanently deletes a subtree and snapshots for those
  nodes.
- `togglePinNode(id, pinned)` / `setNodeTags(id, tags)` — node presentation data.
- `createSiblingAfter(nodeId, opts)` — inserts a sibling at `order + 0.5`, then
  normalizes siblings.
- `mergeNodes(targetId, sourceId)` — concatenates document block content,
  reparents source children, removes source, removes source snapshots, and runs
  atomically. It assumes document-like TipTap block arrays where possible.
- `patchNodeMeta(id, partial)` — atomic read/modify/write merge for metadata,
  preventing concurrent field edits from clobbering each other.
- `duplicateNode(id)` — copies a complete subtree, remaps IDs and parents,
  places the copy after the source using fractional order, and normalizes.
- `normalizeOrders(projectId, parentId)` — rewrites sibling order to integers.
- `moveNode(id, newParentId, targetIndex)` — reorders/reparents a node,
  prevents moving into its own descendant, and updates sibling orders in a
  transaction.
- `toggleCollapse(id, collapsed)` — persists binder expansion state.

### Starter structure and migration

- `structureFor(type, docType)` — private format template. Novels/series/
  manuscripts start with a chapter and scene; screen formats use acts/scenes;
  poetry and essays use sections; worldbuilding uses Overview plus category
  folders.
- `createDefaultStructure(project)` — recursively materializes a `StructSpec`
  tree through `createNode`.
- `migrateChapterContentToScenes()` — session-guarded, idempotent migration of
  old prose stored directly on chapter containers into a new scene at the top
  of each chapter.

### Codex operations

- `createCharacter`, `updateCharacter`, `modifyCharacter`, `deleteCharacter` —
  CRUD; deletion removes relationships pointing at the character and removes
  the ID from scene metadata.
- `createLocation`, `updateLocation`, `deleteLocation` — CRUD; location delete
  clears scene `locationId` references.
- `createThread`, `updateThread`, `deleteThread` — CRUD for plot threads;
  scene membership is stored but not fully surfaced in the current UI.
- `createSnapshot(nodeId, label, auto)` — captures body/content/text/count and
  title; automatic snapshots are bounded to 30 per node.
- `restoreSnapshot(snapshotId)` — creates a “Before restore” automatic snapshot
  and writes snapshot body/text/count back to the node. The current UI then
  signals the open editor through `useUI.reloadEditor()` so the visible TipTap
  instance reloads instead of overwriting the restored body.
- `deleteSnapshot(id)` — permanent snapshot delete.

### Projects, lore and maps

- `trashProject`, `restoreProject`, `togglePinProject` — project-level soft
  delete, restore, and pinning.
- `createWorldElement`, `updateWorldElement`, `deleteWorldElement` — lore CRUD.
- `getOrCreateMap(projectId)` — returns the first project map or creates the
  initial 1000×640 map.
- `updateMap(id, patch)` — partial map update with timestamp.

## 7. State architecture

### `useSettings`

Zustand `persist` store named `parchment-settings`. It stores:

- `settings`: active theme, interface scale, sidebar density, default language,
  spellcheck, focus/typewriter modes, autosave flag, AI configuration,
  onboarding flag, and `updates` (`checkOnStartup`, `lastCheckedAt`,
  `skippedVersion`);
- `customThemes`;
- per-language added/ignored dictionary words;
- `stats`: daily goal, date-keyed history, and last word-count baselines;
- last project/node navigation memory.

Functions include `setSettings`, `setAI`, `setActiveTheme`, `allThemes`,
`activeTheme`, `saveCustomTheme`, `deleteCustomTheme`, dictionary add/remove
operations, `setDailyGoal`, `recordWordCount`, `todayWords`, `streak`,
`setLastLocation`, and `importBackupState`.

`recordWordCount` calculates a delta against a per-node baseline. It clamps
today’s total at zero, and returns the delta so the editor can increment the
session counter. Deletions can therefore produce a negative delta in the
stored path but are not added to session words because the editor only adds
positive deltas. `streak()` walks back up to ten years and allows an empty today
to continue yesterday’s streak.

The store has a custom deep merge for settings, AI, stats, and dictionaries,
plus a v2 migration from the former `local` AI default to Ollama. If future
fields are added, update both defaults and merge/migration behavior together.

### `useUI`

Zustand `persist` store named `parchment-ui`. Durable layout preferences are
persisted: left/right panel state, selected right tab, workspace mode, ribbon,
editor zoom, session start and session words. Transient state is intentionally
not persisted: command palette, find bar, distraction-free state, save status,
reload state, elapsed session milliseconds, and toasts.

Functions include panel toggles, tab/view setters, `setDistractionFree`, zoom
clamping (0.7–1.8), workspace mode presets, ribbon/find/command toggles,
`startSession`, `addSessionWords`, `tickSession`, `resetSession`, save-state
markers, and toast creation/dismissal.

The store is also the bridge for snapshot/editor reload: `reloadEditor(nodeId)`
increments `editorReloadToken` and identifies the affected document.

### Theme application

`useApplyTheme()` watches active theme, interface scale, custom themes, and
sidebar density. `applyTheme()` writes all semantic RGB triplets and editor
typography variables to `document.documentElement`, toggles the `dark` class,
sets `colorScheme`, and sets `data-density`. The built-in themes are nine named
presets: Classic Paper, Night Writer, Warm Sepia, Minimal White, Ink Black,
Forest Desk, Midnight Blue, Manuscript, and Script Studio.

`hexToTriplet()` and `tripletToHex()` bridge native color controls and the
space-separated CSS token format.

## 8. Interface architecture and user flows

### Dashboard (`src/pages/Dashboard.tsx`)

The dashboard is a sticky-header project library with:

- Parchment branding;
- native/browser import for JSON, TXT, Markdown, and DOCX;
- settings/help buttons;
- new-project button;
- daily goal, today’s words, and streak summary;
- title/genre search;
- Active / Archived / Trash tabs;
- project cards with type icon, status, author/genre, word count, target
  progress, language, deadline/relative update time, pin marker, and actions.

`Dashboard()` subscribes to all projects and nodes through `useLiveQuery`, seeds
two samples on first run when onboarding is incomplete and the DB is empty,
computes per-project compile word counts, filters/sorts projects, opens the
workspace, and routes imports. `ProjectCard()` renders project metadata and the
actions for open/edit/pin/duplicate/archive/export/trash/restore/permanent
delete.

The card interface is visually calm and scannable. The main risks are data
integrity and interaction consistency: native/confirm pathways should remain
consistent with the app’s custom confirmation system, and dashboard-derived
counts should always use the same compile/deleted rules as `projectWordCount`.

### New project (`NewProjectModal.tsx`)

`NewProjectModal()` is both create and edit mode. It manages title, type,
author, language, genre, logline, target words, deadline, and busy state. In
create mode it selects a random accent color and invokes `createProject`; in
edit mode it calls `updateProject`. The format grid makes the starter tree
visible before creation, which is useful progressive disclosure.

### Workspace (`src/pages/Workspace.tsx`)

`Workspace()` is the orchestration component. It live-queries project, nodes,
characters, and locations; removes trashed nodes from the live working set;
remembers the last opened node; starts a writing session; handles missing-project
redirects; collapses panels on narrow screens; installs Cmd/Ctrl+K and Cmd/Ctrl+F;
and routes view selection.

Important internal callbacks:

- `selectNode(node)` chooses the node, chooses editor vs corkboard for a
  container, and records navigation memory.
- `addStructure(kind)` creates a scene inside a selected container, after a
  selected document, or at root; chapter/note always go to root.
- `splitScene(after)` creates a sibling scene from the editor’s trailing blocks.
- `openProfile(kind, id)` switches to Characters/Locations and selects an entry.
- `createEntry(kind, name)` creates a codex record and opens it.
- `askAssistant(text)` seeds the right-panel assistant.
- The command list builder registers view navigation, creation, workspace modes,
  focus modes, formatting, search, project actions, and document jumps.

Views are `editor`, `outline`, `corkboard`, `characters`, `locations`,
`threads`, `timeline`, `worldbuilding`, `research`, `notes`, and `trash`.
Container selection opens the corkboard for that subtree; documents open the
TipTap editor.

`LeftSidebar` combines project identity, `Binder`, navigation tiles, and
`GoalsWidget`. `Topbar` exposes panel toggles, Write/Board/Outline segmented
navigation, language, zoom, save status, command/find, mode/ribbon, focus,
distraction-free, export, settings, and inspector controls. `RightPanel`
provides Inspector/Assistant/Notes/History tabs and live-loads codex context.

Workspace modes:

- Minimal: hides both sidebars and ribbon.
- Standard: opens sidebars and hides ribbon.
- Advanced: opens sidebars and shows ribbon.

Distraction-free rendering intentionally mounts a reduced editor surface with
an exit button and keeps command/find overlays available.

### Binder (`features/projects/Binder.tsx`)

`Binder()` builds live manuscript nodes, hides note/research-only branches via
`manuscriptNodes`, builds a forest, sorts pinned items first, and renders a
keyboard-addressable ARIA tree. It supports:

- add at root and add inside;
- expand/collapse;
- click, Shift range selection, Cmd/Ctrl multi-selection;
- Arrow navigation, Enter open, F2 rename, Space toggle selection, Delete/
  Backspace move to trash;
- HTML drag/drop before/after/inside;
- rename with Escape cancellation guard;
- duplicate, pin, merge with adjacent document, status changes, node export,
  compile inclusion, and trash actions.

`DropLine()` is the visual before/after insertion line. `walkVisible()` drives
keyboard order and respects collapsed branches. `handleDrop()` calculates
full-sibling positions before calling `moveNode`, expands a collapsed inside
target, and handles a multi-selection in visible order.

Keep the Binder and `lib/tree.ts` rules aligned: notes/research are intentionally
excluded from the manuscript binder and remain discoverable through Notes or
their dedicated boards.

### Planning surfaces

- `Corkboard()` shows direct children of a selected root as fixed-height cards.
  Cards expose title/open, synopsis autosave, status, duplicate, trash, and
  opening actions. It currently includes drag/reorder behavior using
  `moveNode`; the board is a direct-sibling board, not a recursive tree.
- `OutlineView()` flattens the complete forest depth-first, shows depth,
  status, icon, title, synopsis, and words, and supports drag reorder and rename.
- `TimelineView()` uses `orderedDocuments`, displays POV/date/label/status and
  supports reading-order vs date sorting. Dates are free text, so “chronology”
  is lexical/numeric string sorting rather than a parsed calendar model.
- `NodeBoard()` is a reusable card grid for notes or research, sorted by
  `updatedAt`, with create/open and synopsis preview.
- `NotesPanel()` lists project note/research nodes and extracts inline comment
  marks from the current document via `extractComments()`.
- `InspectorPanel()` autosaves title, status, target words, synopsis, language,
  tags, pin, POV, goal, conflict, outcome, beat label, in-world date, location,
  character membership, and compile inclusion.
- `CharacterManager()` and `LocationManager()` are two-pane codex editors with
  live lists and auto-saving detail forms. Character relationships use atomic
  `modifyCharacter()` updates.
- `ThreadManager()` edits name, description, status, and color. The thread
  `sceneIds` contract exists, but scene attachment is still not a first-class
  control in the visible manager.
- `TrashView()` lists soft-deleted nodes and provides restore/permanent delete;
  bulk emptying confirms before deleting.
- `SnapshotsPanel()` lists per-node snapshots, manual capture, compare, restore,
  and delete. `VersionCompareDialog()` uses word-level text diff and does not
  represent rich formatting changes.
- `WorldbuildingManager()` switches between Lore and Map. Lore groups entries
  by ordered category and edits summary/details/rules; Map mounts the SVG editor.

## 9. Editor system

### `DocumentEditor.tsx`

`DocumentEditor()` creates a stable TipTap editor per node/document type. It
uses a 700 ms debounced content save, flushes on unmount, `pagehide`,
`beforeunload`, and hidden visibility. On each save it updates DB content,
word count, daily/session counts, and the global save indicator.

Important helpers and callbacks:

- `wordAt(view, pos)` maps a ProseMirror position to a Unicode-aware word,
  respecting inline atoms/hard breaks.
- live dictionary sync pushes persisted added/ignored words into `spellService`.
- editor `handleKeyDown` intercepts Cmd/Ctrl+S and flushes autosave.
- editor click handling opens spell suggestions or comment popovers.
- `refreshSpell`, `replaceWordAt`, `addWordToDict`, and `ignoreWord` update the
  spell layer and user dictionary.
- `openCommentDialog` requires a non-empty selection; `addComment` applies a
  comment or note mark.
- `buildContext` packages the current text and local story analysis for a
  provider.
- `runTransform` supports ask, rewrite/improve/tone/language operations and
  falls back to the local provider on errors.
- `applyReplacement` guards against stale async ranges: it verifies the old
  selected text before replacing and inserts at the cursor if the text changed.
- `splitHere` divides top-level blocks at the current block and asks Workspace
  to create the sibling scene.
- `onContextMenu` gathers spell state, selected text, character/location name
  matches, and unknown capitalized words for `EditorContextMenu`.
- `findNameMatch` compares a word against character names/aliases and location
  names.
- `EditorStatusBar` displays words, characters, reading time, estimated pages,
  and saving/saved state.

The editor surface is a theme-aware “paper sheet” in normal mode. Minimal and
distraction-free remove some chrome. Typewriter mode adds large top/bottom
padding and smooth-centers the selection on `selectionUpdate`.

### Extensions

`buildExtensions(opts)` assembles StarterKit (headings through h4), placeholder,
character count, multicolor highlight, typography, text style/color/font
family/font size, BlockStyle, CommentMark, SearchExtension, Spellcheck, and
either ScriptElementExt or prose TextAlign. FocusBlock is always present.

- `BlockStyle` adds `lineHeight`, `spacingAfter`, and `pstyle` global block
  attributes and commands `setBlockLineHeight`/`setBlockSpacing`.
- `ScriptElementExt` adds a `script` paragraph attribute. Tab/Shift+Tab cycle
  screenplay element types; Enter flows according to `ADVANCE` (heading →
  action, character → dialogue, dialogue → action, and so on).
- `CommentMark` stores comment/note text and ID as an inline mark with commands
  `setComment` and `setNote`; rendering is styled by `.pm-comment` and `.pm-note`.
- `FocusBlock` adds a `has-focus` decoration to the selected top-level block.
- `SearchExtension` stores term/case/matches/active index in a ProseMirror
  plugin and provides search/replace-all commands.
- `Spellcheck` decorates misspellings and re-scans after a debounce, mapping
  decorations through ordinary transactions.

### Editor action functions

`editorActions.ts` contains the command palette/toolbar façade:

- `setTextType` / `activeTextType` map friendly labels to paragraph, headings,
  blockquote, dialogue, and note styles.
- `toggleBold`, `toggleItalic`, `toggleUnderline`, `toggleStrike`,
  `toggleBulletList`, `toggleOrderedList` apply marks/lists.
- `clearFormatting` removes all marks and clears block nodes; be cautious because
  this can also remove comment/note marks and script/block styles.
- `setColor`, `setHighlight`, `setFontFamily`, `setFontSize` apply or unset
  selected inline formatting.
- `setAlign`, `setLineHeight`, `setSpacing`, and `insertSceneBreak` cover block
  presentation.
- `setScriptElement` writes the screenplay paragraph attribute.

`activeEditor.ts` holds the singleton active TipTap editor, with
`setActiveEditor`, `getActiveEditor`, and `subscribeActiveEditor` for command
palette formatting from outside the editor component.

`EditorToolbar`, `Ribbon`, `BubbleToolbar`, `SlashMenu`, `FindReplace`,
`EditorContextMenu`, `CommentDialog`, and `SelectionResultDialog` are UI
surfaces over these commands. The slash menu is structure-aware and can create
scene/chapter/note items through Workspace callbacks.

## 10. Spellcheck

`spellService` lazy-loads Hunspell `.aff/.dic` assets from
`public/dictionaries/{lang}` for English, Dutch, French, German, and Spanish.
It caches promises/spellers, maintains a synchronous resolved cache for
ProseMirror decoration passes, and merges the persisted personal dictionary.

Public behavior:

- `onReady(fn)` subscribes to dictionary-load completion.
- `isReady(lang)` reports a loaded language.
- `load(lang)` returns a cached async speller.
- `correct(lang, word)` is synchronous; unloaded dictionaries optimistically
  treat words as correct while initiating a load.
- `suggest(lang, word)` returns up to seven suggestions.
- `addWord` and `ignore` update in-memory acceptance state.

`SpellcheckExtension.scan()` skips code marks, numbers, short acronyms, and
single-character words; it produces wavy underline decorations and
`misspellings`. `misspellingAt()` finds a misspelling at a document position.
`SpellPopover` is portalled to `document.body` and offers replace, add to
dictionary, and ignore.

## 11. Story Assistant

### Local analysis

`analyzeStory(input)` produces `StoryAnalysis` from text and project context.
Private routines include `stripDialogue`, `detectPOV`, `detectNames`,
`dialogueRatio`, `mattr`, `adverbInfo`, `pacingLabel`, and metric/insight
builders. It uses multilingual lexicons for pronouns, first-person verbs,
honorifics, speech verbs, particles, stopwords, places, adverbs, and motion
verbs.

Metrics include words, sentences, paragraphs, dialogue ratio, average sentence
length, reading minutes, adverb ratio, unique-word ratio, and longest paragraph.
Insights/suggestions are heuristic and should be treated as directional rather
than authoritative. The accuracy test corpus covers words, sentences, POV,
dialogue, names, adverbs, vocabulary, pacing, tone, tension, and genre cases.

### Provider abstraction

`StoryProvider` exposes `generate`, `complete`, and `transform`. `getProvider`
returns one of:

- local built-in heuristic provider;
- OpenAI Chat Completions;
- Anthropic Messages;
- Google Gemini `generateContent`;
- Ollama `/api/chat`.

`fetchWithTimeout` aborts after 90 seconds. `callOpenAI`, `callAnthropic`,
`callGemini`, and `callOllama` normalize provider APIs. `cloudTransform()` maps
rewrite kinds to a replacement or feedback result. API keys are local settings
only; direct browser calls may be blocked by CORS, and callers fall back to the
local provider.

The local generator uses `block()` to offer multiple options with explicit
narrative effects. `localTransform()` handles grammar, synonyms, stronger-word
notes, simplifying, tone suggestions, and basic feedback.

### Advanced analysis

`advancedAnalysis.ts` defines document kinds, score/finding/priority result
types, `resolveDocKind`, prompt schemas, `buildAdvancedMessages`, `parseAdvanced`,
and `runAdvancedAnalysis`. It expects strict JSON from a connected model and
the panel renders parsed scores/findings/priorities where parsing succeeds.

`AssistantPanel()` selects node/project scope, computes local analysis, manages
chat messages, scrolls the transcript, consumes seeded questions, runs cached
advanced analysis, renders meters and score bars, and sends quick prompts.
`Markdownish` is a small renderer for provider responses; it is not a full
Markdown parser.

## 12. Import/export

### Block model

`contentToBlocks()` converts TipTap JSON into a flat export model: headings,
paragraphs with script/alignment attributes, blockquotes, horizontal rules,
lists, and code blocks. `runsFromInline()` preserves bold, italic, underline,
strike, code, and hard breaks.

`buildManuscript(nodes, scope, compileOnly)` builds ordered `ManuscriptItem`s
from the tree. `scope` is `manuscript`, `notes`, or `all`; compile-only filters
out nodes whose `includeInCompile` is false.

### Formats

`runExport()` dispatches Markdown, plain text, HTML, PDF/print, Fountain, DOCX,
EPUB, and JSON. Supporting functions are:

- `buildCodex`, `codexMd`, `codexText`, `codexHtml` — optional story-bible output;
- `slug`, `esc`, `runsText`, `runsMd`, `runsHtml`, `blocksMd`, `blocksHtml` —
  serialization primitives;
- `toMarkdown`, `toPlainText`, `toHTML`, `toFountain` — text formats;
- `toDocxBlob` — lazy-loads `docx`, creates title page/headings/paragraphs;
- `toEpubBlob` — lazy-loads JSZip and creates a valid single-spine EPUB;
- `toProjectBackup` — serializes one project plus nodes/codex/world/maps;
- `runExportNode` — collects a subtree and exports it with scope `all`;
- `printViaIframe` — hidden iframe print path used for PDF.

`ExportDialog` chooses scope, optional codex inclusion, and format. Browser
exports use `file-saver`; Tauri exports use a native save dialog and Rust byte
command.

`exportFullBackup()` serializes the complete Dexie state plus settings. `importBackup`
validates/reads JSON and restores full or single-project data. `importDoc.ts`
contains `para`, `heading`, `textToBlocks`, `markdownToBlocks`, `docxToBlocks`,
and `importDocumentFile` for TXT/Markdown/DOCX into a new project.

## 13. Desktop/Tauri layer

`src-tauri/src/main.rs` exposes:

- `write_file_bytes(path, contents)` — creates parent directories and writes bytes;
- `read_file_bytes(path)` — reads bytes from a selected path.

The app registers window-state, dialog, opener, and desktop single-instance
plugins. The native menu includes File/Quit, Edit undo/redo/cut/copy/paste/select
all, and Window actions. The Tauri window starts at 1280×832, with 880×600
minimum dimensions. `isDesktop`, `saveBlob`, and `openFileNative` hide the
browser/native file-dialog difference from the rest of the app.

Native commands receive byte arrays over IPC. This is adequate for ordinary
writing exports but is not an efficient streaming path for very large backups.
The Tauri CSP is currently null; review this before introducing more external
content or provider integrations.

The shell also registers `tauri-plugin-updater` and `tauri-plugin-process`
(desktop targets only) and adds a Help submenu whose single item emits
`parchment://check-for-updates`. The frontend listens for that event in
`initUpdates()`, so the native menu and the Settings button drive the same
state machine. `capabilities/default.json` grants `updater:default` and the
single `process:allow-restart` permission rather than `process:default`.

## 13a. Release, distribution and update architecture

The distribution artifact is a Windows NSIS installer (`bundle.targets` is
`["nsis"]`, `installMode` is `currentUser`), published to GitHub Releases with a
signed updater archive and a `latest.json` manifest.

**Version authority.** `package.json` owns the version. `scripts/version.mjs`
propagates it to `tauri.conf.json`, `Cargo.toml` and both lockfiles; `check`
fails CI when they drift, and `set` refuses a version that is not strictly newer.
Vite injects the same value as `__APP_VERSION__`, which `src/lib/appInfo.ts`
exposes to the UI — so About, the installer and the updater cannot disagree.

**Channels.** The Tauri updater reads its endpoints from the compiled
configuration, so the channel is chosen at build time, not at runtime. Stable
builds poll `releases/latest/download/latest.json`; preview builds are compiled
with `tauri.preview.conf.json` and poll the rolling `preview` tag. Preview
versions are derived as `X.Y.(Z+1)-preview.N`, which sorts above the released
`X.Y.Z` and below the eventual `X.Y.(Z+1)`, so a stable release always
supersedes a preview. The tradeoff — no in-app channel switching — is recorded
in `docs/adr/0001-release-channels-and-updates.md`.

**Update state machine.** `features/updates/updateModel.ts` is pure: a reducer
over `idle → checking → up-to-date | available → downloading → ready →
installing → restarting`, with `error` reachable from the busy states and
`reset` returning to the last safe resting state. It refuses any candidate that
is not strictly newer (`isNewerVersion`, which fails closed on unparseable
input) and ignores illegal transitions rather than throwing.
`updateService.ts` owns the side effects: a lazily imported Tauri backend behind
an injectable seam, the six-hour automatic-check policy, the eight-second
startup delay, the native-menu listener, and diagnostics that contain no project
content.

**Update safety.** `lib/pendingWrites.ts` is a registry of debounced writers —
the editor's 700 ms autosave and the world map's 300 ms geometry save both
register. `installUpdate()` flushes them with a five-second bound and
**aborts the update** if any writer fails or the flush times out; the installed
copy is untouched at that point, so aborting is always safe.

**Publication safety.** `release.yml` builds into a draft release, downloads the
`latest.json` it produced, validates it with `scripts/verify-release.mjs`
(version, required targets, tag-referencing URLs, non-empty signatures) and only
then publishes. GitHub's `releases/latest` excludes drafts and prereleases, so a
failed release is invisible to installed copies.
`src/__tests__/releaseConfig.test.ts` locks the decisions that are expensive to
reverse: identifier, public key, endpoints, permissions and workflow rules.

## 14. Styling and visual language

Tailwind semantic colors are CSS-variable backed RGB triplets. The visual
system uses warm paper surfaces, serif editor typography, Inter chrome, compact
rounded controls, low-contrast borders, soft shadows, and restrained fade/scale
animations. The editor’s paper sheet deliberately floats above the workspace;
script documents use monospaced typography and screenplay indentation rules.

The CSS has strong editor coverage:

- prose indentation/spacing/justification;
- heading hierarchy;
- dialogue/note paragraph styles;
- quote/list/code rendering;
- scene-break ornament;
- screenplay scene-heading/action/character/dialogue/parenthetical/transition/
  shot classes;
- search/spell/comment decorations;
- focus-mode dimming;
- custom scrollbars, sliders, density row classes, and reduced-motion rules.

Current themes apply typography and colors, but hardcoded editor shadows,
screenplay proportions, map stroke/label colors, and some icon/control colors
remain outside the theme token system. A dark custom theme can therefore look
less coherent in the map and paper shadow than in the surrounding chrome.

## 15. World map visual analysis

### Intended interaction model

`WorldMapEditor` is a single SVG canvas with a toolbar and two overlay panels.
Tools are:

1. Select/pan/move;
2. Draw continent;
3. Cut a continent into countries;
4. Add city;
5. Add place.

The toolbar also has land colors, ocean colors, undo/redo, zoom in/out, fit,
legend toggle, and PNG/SVG export. The canvas can be panned by dragging the
background in select mode, regions/markers can be moved by dragging, and the
selection inspector edits name, kind, color, and deletion. The legend lists
continents/countries/cities/places and can select them. Label toggles separately
control region and marker names.

The implementation is intentionally dependency-light: no canvas library or
geospatial library is used. Geometry is plain arrays of `{x, y}` and all
changes are debounced into `updateMap()` after 300 ms.

### Geometry pipeline

- `smoothClosedPath(points)` converts freehand polygon vertices into a closed
  Catmull–Rom-like cubic Bézier path. Fewer than three points fall back to a
  straight closed polyline.
- `centroid(points)` returns the arithmetic mean of vertices, used for labels.
- `pointInPolygon(point, polygon)` uses ray casting for hit testing.
- `clipHalfPlane(poly, a, b, keepLeft)` implements Sutherland–Hodgman clipping
  against an infinite line through the cut endpoints.
- `hexShade(hex, pct)` creates the second country color by blending toward
  white/black.
- `dist2` is a squared-distance threshold helper for freehand sampling and cut
  minimum length.
- `toMap(pointer)` uses the SVG screen CTM inverse, so pointer input remains
  correct under viewBox zoom and browser scaling.
- `zoomBy(factor, center)` keeps a zoom center stable and clamps viewBox width
  to 140–4000; `fit()` resets to map dimensions.

### Confirmed visual/interaction weaknesses

#### 1. The smoothing spline can overshoot the user’s landmass

The stored vertices are the user’s path, but the rendered path is a cubic
interpolation. Catmull–Rom control points can overshoot around sharp turns,
close loops, narrow bays, or adjacent coastlines. The visual edge can therefore
leave the stroke the user drew, create pinched corners, or self-intersect. The
hit test and cut operation still use the raw polygon, not the rendered curve.
That creates a particularly confusing mismatch: a click can appear visually
inside a smoothed area but be mathematically outside the raw polygon.

#### 2. Freehand sampling is resolution-dependent

Points are appended only when squared distance from the previous point is at
least 49 map units. At a zoomed-out view this may produce a sparse, angular
shape; at a zoomed-in view the same physical gesture can generate a much denser
shape. There is no simplification, resampling, minimum/maximum vertex count,
or smoothing-strength control. Large noisy paths are persisted directly and
then fed into a costly spline on every render.

#### 3. Cut semantics do not match the visible cut stroke

The UI suggests dragging a line “across” a region, but `performCut()` clips the
region against the infinite line through the start/end points. The visible
segment length only determines whether the gesture is non-trivial; it does not
limit the cut. A short line near one edge can split the entire landmass, and a
line that visually appears not to cross the whole region may still produce two
valid half-planes. The operation also assumes a simple polygon and does not
handle concave pieces, self-intersections, or holes robustly.

#### 4. Cut results lose design continuity

Both resulting countries are named `New country`; one receives the original
color and the other a lightened shade. The original continent is removed, but
there is no lineage, shared boundary model, region grouping, or way to merge
countries back. Repeated cuts can produce many visually similar unnamed pieces.
The map has no reshape vertex editor, so a bad cut is effectively undo-only.

#### 5. Pan and movement are not bounds-clamped

`onPointerMove` allows the viewBox and region/marker coordinates to move
arbitrarily. Users can pan the map completely away from the viewport or drag a
landmass/marker off-canvas. The oversized background rectangle masks some of
this, but it does not provide a reliable “world extent” or recovery other than
Fit map. A map editor should either clamp the camera with a modest overscroll
margin or provide an explicit reset/home affordance that is always easy to find.

#### 6. Zoom presentation is not scale-aware

Region strokes, marker sizes, label font sizes, white label outlines, and legend
scale are fixed in SVG user units. Zooming in makes labels and strokes look
heavy; zooming out makes them disappear or overlap. Markers use fixed 7/9 unit
radii and labels start at `x + 12`, so dense cities become a stack of labels with
no collision avoidance. The current implementation has no screen-space
constant-size markers or label decluttering.

#### 7. Labels use arithmetic centroids, not visual label anchors

`centroid()` averages vertices, which is not the polygon centroid and may fall
outside a concave or crescent-shaped landmass. A label can consequently float in
water, under another region, or on an unhelpful narrow point. Region labels are
always rendered even when the region is tiny relative to the current zoom.

#### 8. Layer order and hit testing are only partly coordinated

Regions render in array order and hit testing walks the array in reverse, which
is good for topmost regions. However labels are pointer-disabled and markers
render after labels, while the whole SVG background owns the pan/draw pointer
handler. The event propagation is carefully stopped for regions/markers, but
the interaction model becomes hard to predict when a marker overlaps a region,
when tools are changed mid-gesture, or when a selected object is beneath a
later object.

#### 9. Drag history is captured before movement, but persistence is deferred

Region and marker drag starts push an undo snapshot; pointer movement uses
`setLive()` with no save; pointer-up calls `apply(m => m)` to schedule a save.
This is a sensible performance shape.

The unmount/close half of this has been fixed: `schedule()` now records the
pending map in a ref and `flushMap()` writes it immediately. `flushMap` runs on
unmount, on `pagehide`, on hidden visibility, and through the
`registerPendingWrite` registry — which is also what an application update waits
for before restarting. What remains open is history coverage: undo/redo
snapshots still contain only region/marker arrays, not map background,
dimensions or name, so history is intentionally geometry-only and can feel
inconsistent when mixed with color/background edits.

#### 10. Background “select/pan” conflicts with selection expectations

In select mode, clicking empty map starts a pan gesture and clears selection.
There is no marquee selection, no click-without-movement distinction, and no
explicit hand/pan mode. A user trying to deselect or inspect empty space can
accidentally shift the camera. A click on a region always starts a move gesture;
there is no threshold before a click becomes a drag.

#### 11. The legend and inspector compete for map space

The legend is a fixed 13rem-ish overlay in the upper-right and the selection
inspector is fixed in the lower-left. On the smallest supported Tauri window or
when the interface scale is increased, these overlays cover a large share of a
small map. The toolbar wraps but the overlays do not adapt their width/position.
There is no compact legend mode, docked inspector, or responsive collapse.

#### 12. Map/codex semantics are disconnected

The map marker schema offers `locationId`, but the marker inspector only edits
name/kind/color. Adding a city does not create or select a `Location`; adding a
Location does not place a marker. This makes the map visually attractive but
isolated from scene metadata and the location codex. The same place can easily
be duplicated under different names.

#### 13. Map accessibility is mostly title-driven

Toolbar buttons have titles, but SVG paths/markers do not have explicit labels,
keyboard focus, or keyboard move commands. The legend is the practical keyboard
selection route, but the selected shape itself is not exposed as a meaningful
focusable SVG object. Color is also a major semantic signal for region/marker
identity. The map needs a non-color distinction (kind is partly present) and
keyboard-accessible editing if it is to be used without a pointing device.

### Recommended map remediation order

1. Add pointer-movement thresholds and a real pan/select distinction. Clamp the
   viewBox with a bounded overscroll margin and provide a guaranteed Home/Fit
   reset.
2. Normalize freehand input in map space: resample by arc length, simplify with
   a tolerance, enforce a minimum/maximum vertex count, and render either the
   simplified polygon or a tension-limited spline that cannot overshoot.
3. Make hit testing use the same geometry that is rendered, or deliberately
   render raw polygons with a controlled smoothing overlay. Add a proper
   polygon centroid/visual-polylabel anchor.
4. Change cut behavior to require a segment that intersects the selected region
   boundary twice, show a clear preview of the actual split, and reject invalid
   concave/self-intersecting cases with a toast. Preserve parent/lineage data if
   countries are a first-class concept.
5. Make labels/markers screen-space aware: inverse-scale stroke and label sizes,
   declutter labels at low zoom, and give selected items a stronger outline.
6. Flush pending map saves on unmount/pagehide and put all meaningful map edits
   into one coherent history model. Consider storing camera state separately
   from document undo history.
7. Connect markers to `Location` records, add a marker-to-location picker, and
   offer “create location from marker”.
8. Add keyboard focus, arrow-key movement, accessible names, and a list fallback
   that exposes all regions/markers and their coordinates/kinds.

## 16. Confirmed technical risks and maintenance notes

These are current-code observations, not a dump of the older `.audit-findings`
file. That JSON contains historical findings; several were fixed since it was
written.

### Data integrity

- `archiveProject(false)` sets status to `drafting`, so unarchiving does not
  restore the exact prior status.
- `restoreSnapshot()` restores body/text/count but not the snapshotted title,
  synopsis, or metadata. The stored `nodeTitle` is useful for display but is not
  part of the restore contract.
- There is no normal-writing automatic snapshot schedule. Automatic snapshots
  are currently used as the pre-restore safety snapshot, while manual snapshots
  are explicit.
- Soft-deleted nodes retain snapshots until hard deletion.
- Thread `sceneIds` and marker `locationId` are modelled but not fully wired to
  the corresponding UI workflows.
- `duplicateProject()` remaps node and thread links but does not establish a
  universal cross-entity ID map for every possible future relationship.
- `saveNodeContent()` touches the project; several structural operations do not
  consistently update project `updatedAt`, so dashboard recency can lag a move,
  trash, or restore.
- Full-table scans are used for some deleted/subtree queries. This is acceptable
  for small projects but should be profiled for very large manuscripts.

### Editor behavior

- The autosave setting is represented in `Settings`, but `DocumentEditor` always
  uses its debounce path. Treat “autosave” as currently always-on unless this is
  deliberately implemented.
- Save status is global UI state rather than keyed by node; rapid node switches
  can show the resolution of a different document’s save.
- `splitHere()` uses `setContent()` for the retained blocks, which is a coarse
  transaction and can make undo/caret behavior less natural than a range delete.
- `clearFormatting()` is broad: it removes all marks, including annotation
  marks, and clears block nodes. Do not bind it to a destructive workflow without
  deciding whether comments/notes should survive.
- `setBlockLineHeight` and `setBlockSpacing` call `updateAttributes` for both
  paragraph and heading types; this is simple but broad.
- Find/spell re-scans are debounced/mapped, but very large documents still have
  whole-document work when a forced scan occurs.

### UI and accessibility

- `Menu` is a lightweight portal menu, not a full ARIA menu: it closes on outside
  mouse/scroll/Escape but does not provide complete roving-focus/arrow-key menu
  navigation.
- `Segmented` communicates selection visually and should gain `aria-pressed` or
  tab/radio semantics if accessibility is a target.
- `Progress` has no explicit value semantics for assistive technology.
- Several card/control surfaces rely on hover to reveal secondary actions.
- The map’s primary SVG objects are not keyboard-addressable.
- `ErrorBoundary.reset()` retries the same tree; a deterministic persisted-state
  error may need a clear-local-state/reload recovery path.
- Interface scale affects root rem sizing, so large scale values can make fixed
  overlays and multi-column forms cramped.

### Performance

- `Binder` builds/filter forests and computes subtree counts during render. The
  current `subtreeWordCount()` repeatedly performs `nodes.find()` while walking,
  making large trees a likely typing-time hotspot.
- The build is a single large application chunk. Dynamic imports already exist
  for DOCX/EPUB, but route-level splitting could reduce initial load.
- Map path strings and labels are recomputed every render; simplifying/normalizing
  geometry at write time would reduce visual and CPU cost.
- Dexie live queries are convenient and correct for small workspaces, but the
  workspace currently subscribes to broad project tables rather than narrowly
  selecting only the active node.

## 17. Recommended engineering conventions

1. Keep all durable manuscript/codex/map mutations in `data/repo.ts` and preserve
   transactions when a mutation touches more than one table.
2. Keep TipTap JSON plus plain-text mirror plus word count synchronized through
   `saveNodeContent()`; do not hand-edit only one representation.
3. Use `patchNodeMeta()` for metadata arrays and fields that can be edited by
   multiple panels.
4. When changing a live editor from outside TipTap, cancel pending autosave and
   use the existing reload signal so stale editor state cannot overwrite DB data.
5. For any new settings field, update the TypeScript default, persisted merge,
   migration strategy, Settings UI, and theme/application consumers together.
6. For new destructive actions, use `confirmDialog`, toast a result, and prefer
   soft delete/undo where possible.
7. For new portals (menus, dialogs, popovers), preserve focus, escape behavior,
   viewport collision handling, and accessible names.
8. For map features, maintain a strict distinction between map coordinates,
   screen coordinates, camera/viewBox state, raw geometry, and rendered geometry.
   Never silently mix those spaces.
9. Add tests around data-layer invariants before changing tree movement,
   snapshot restore, duplication remapping, or map geometry. The existing test
   suite is currently weighted toward story-assistant heuristics and does not
   comprehensively protect these workflows.

## 18. Most useful files to read first

For a new maintainer, read in this order:

1. `README.md` and `docs/RESEARCH.md` for the product promise;
2. `src/types/index.ts` for the domain contracts;
3. `src/data/db.ts` and `src/data/repo.ts` for persistence invariants;
4. `src/pages/Workspace.tsx` for composition and navigation;
5. `src/features/editor/DocumentEditor.tsx` and `extensions.ts` for the writing
   surface;
6. `src/features/projects/Binder.tsx` and `src/lib/tree.ts` for hierarchy;
7. `src/features/planning/WorldMapEditor.tsx` for the map’s complete interaction
   and rendering model;
8. `src/store/useSettings.ts`, `useUI.ts`, and `useApplyTheme.ts` for cross-cutting
   state;
9. `src/features/export/` before changing content shape or node semantics;
10. `src-tauri/src/main.rs` before changing desktop file behavior.

## 19. Exhaustive source-symbol index

This index is intentionally terse. The preceding sections explain the symbols
that carry domain behavior; this list makes it easier to locate every function-
like symbol in the repository without opening every file first. Constants,
types, interfaces, and TipTap extension objects are included where they are
part of a module’s public surface.

### Application, pages, shell and reusable UI

| File | Functions/components and role |
|---|---|
| `src/App.tsx` | `App` — global theme/migration/routes/overlays. |
| `src/pages/Dashboard.tsx` | `Dashboard` — project query/filter/import/seed shell; `ProjectCard` — project card rendering/actions. |
| `src/pages/Workspace.tsx` | `Workspace` — project query, selected node, view routing, commands, structure callbacks. |
| `src/pages/SettingsPage.tsx` | `SettingsPage`; `SectionTitle`; `Row`; `WritingSettings`; `AssistantSettings`; `DictionarySettings`; `WordList`; `DataSettings`; `AboutSection`. |
| `src/pages/HelpPage.tsx` | `HelpPage` — shortcuts and feature help; module constants `isMac` and `mod` select keyboard glyphs. |
| `src/components/CommandPalette.tsx` | `CommandPalette` — filter, group, keyboard index and command execution. |
| `src/components/ErrorBoundary.tsx` | `ErrorBoundary.getDerivedStateFromError`; `componentDidCatch`; `reset`; `render`. |
| `src/components/ProjectIcon.tsx` | `ProjectIcon` — project-type to Lucide component mapping. |
| `src/components/ui/Button.tsx` | `Button` — variant/size button façade. |
| `src/components/ui/IconButton.tsx` | `IconButton` — labeled icon-only button. |
| `src/components/ui/Field.tsx` | `Field`; `Input`; `Textarea`; `Select`. |
| `src/components/ui/Modal.tsx` | `Modal` — portal, Escape, focus capture/trap/restore, labeled dialog. |
| `src/components/ui/Menu.tsx` | `Menu` — anchored portal menu, outside/scroll/Escape close, viewport positioning. |
| `src/components/ui/Auto.tsx` | `useAutosave`; `AutoInput`; `AutoTextarea`; `AutoSelect`. |
| `src/components/ui/misc.tsx` | `Badge`; `Dot`; `Progress`; generic `Segmented`; `Switch`; `Slider`; `EmptyState`. |
| `src/components/ui/Toaster.tsx` | `Toaster` — portal notification stack. |
| `src/components/ui/confirm.tsx` | `confirmDialog`; `ConfirmRoot`; `close` internal resolver. |
| `src/features/workspace/LeftSidebar.tsx` | `LeftSidebar` — Binder/navigation/goals composition. |
| `src/features/workspace/RightPanel.tsx` | `RightPanel` — right-tab live queries and panel dispatch. |
| `src/features/workspace/Topbar.tsx` | `Topbar` — shell controls, mode/focus menus, save and zoom presentation. |
| `src/features/workspace/GoalsWidget.tsx` | `fmtDuration`; `GoalsWidget` — session timer, daily goal, streak. |

### Persistence, domain helpers and seed data

| File | Functions/components and role |
|---|---|
| `src/data/db.ts` | `ParchmentDB.constructor`; exported `db`. |
| `src/data/repo.ts` | `now`; `emptyDoc`; `isContainer`; `isDocument`; `createProject`; `defaultTarget`; `updateProject`; `touchProject`; `deleteProject`; `archiveProject`; `duplicateProject`; `projectWordCount`; `nextOrder`; `createNode`; `defaultTitle`; `numberToWords`; `wordToNumber`; `nextChapterTitle`; `updateNode`; `saveNodeContent`; `renameNode`; `collectSubtree`; `deleteNode`; `restoreNode`; `hardDeleteNode`; `togglePinNode`; `setNodeTags`; `createSiblingAfter`; `mergeNodes`; `patchNodeMeta`; `duplicateNode`; `normalizeOrders`; `moveNode`; `toggleCollapse`; `structureFor`; `createDefaultStructure`; `migrateChapterContentToScenes`; `createCharacter`; `updateCharacter`; `modifyCharacter`; `deleteCharacter`; `createLocation`; `updateLocation`; `deleteLocation`; `createThread`; `updateThread`; `deleteThread`; `createSnapshot`; `restoreSnapshot`; `deleteSnapshot`; `trashProject`; `restoreProject`; `togglePinProject`; `createWorldElement`; `updateWorldElement`; `deleteWorldElement`; `getOrCreateMap`; `updateMap`. |
| `src/data/seed.ts` | `p`, `em`, `hr`, `sp`, `doc` — TipTap fixture builders; `seedSamples` — novel/screenplay demo creation. |
| `src/lib/id.ts` | `uid` — NanoID wrapper. |
| `src/lib/utils.ts` | `cn`; `clamp`; `debounce`; `colorFromString`. |
| `src/lib/format.ts` | `formatNumber`; `formatCompact`; `timeAgo`; `formatDate`; `todayKey`. |
| `src/lib/text.ts` | `lex`; `docToText`; `countWords`; `countCharacters`; `splitSentences`; `countSentences`; `countParagraphs`; `readingMinutes`; `pageEstimate`; `analyzeText`; `formatReadingTime`. Internal lexical constants are `WORDS_PER_PAGE`, `WPM`, `ABBREV`, `BLOCK_TYPES`, `TITLES`, `INTRODUCERS`, and `WORD_RE`. |
| `src/lib/tree.ts` | `buildForest`; `flattenForest`; `orderedDocuments`; `manuscriptNodes`; `subtreeWordCount`; internal `isNoteType`, `isContainerType`. |
| `src/lib/desktop.ts` | `isDesktop`; `saveBlob`; `openFileNative`. |
| `src/lib/semver.ts` | `parseVersion`; `isValidVersion`; `isPrerelease`; `compareVersions`; `isNewerVersion`; `maxVersion`; internal `comparePrerelease`. Shared with `scripts/` through Node type stripping. |
| `src/lib/releaseManifest.ts` | `parseReleaseManifest`; `selectPlatformAsset`; `updaterTargetKey`; `verifyManifest`; `resolveEndpoint`; `ManifestError`; `REQUIRED_TARGETS`. |
| `src/lib/pendingWrites.ts` | `registerPendingWrite`; `flushPendingWrites`; `pendingWriteCount`. |
| `src/lib/appInfo.ts` | `APP_VERSION`; `RELEASE_CHANNEL`; `CHANNEL_LABEL`; `REPOSITORY_URL`; `RELEASES_URL`. |
| `src/hooks/useApplyTheme.ts` | `useApplyTheme` — applies theme/density effects. |
| `src/store/useSettings.ts` | `emptyByLang`; Zustand actions `setSettings`, `setAI`, `setActiveTheme`, `allThemes`, `activeTheme`, `saveCustomTheme`, `deleteCustomTheme`, `addDictWord`, `ignoreWord`, `removeDictWord`, `removeIgnoredWord`, `setDailyGoal`, `recordWordCount`, `todayWords`, `streak`, `setLastLocation`, `importBackupState`; persistence `merge`/`migrate`. |
| `src/store/useUI.ts` | Zustand actions `reloadEditor`, `toggleLeft`, `toggleRight`, `setRightTab`, `openRight`, `setCenterView`, `setDistractionFree`, `setEditorZoom`, `setCommandOpen`, `setWorkspaceMode`, `setRibbon`, `setFindOpen`, `startSession`, `addSessionWords`, `tickSession`, `resetSession`, `setSaving`, `markSaved`, `toast`, `dismissToast`. |

### Projects, planning and worldbuilding

| File | Functions/components and role |
|---|---|
| `src/features/projects/Binder.tsx` | `Binder`; internal `walkVisible`, `focusRow`, `bulkTrash`, `onTreeKeyDown`, `clickSelect`, `addAtRoot`, `addChild`, `handleDrop`, `addMenu`, `siblingDoc`, `rowMenu`, `renderRow`; `DropLine`. |
| `src/features/projects/NewProjectModal.tsx` | `NewProjectModal`; internal `submit` and open/reset effect. |
| `src/features/projects/nodeIcons.tsx` | `NodeIcon`. |
| `src/features/planning/InspectorPanel.tsx` | `InspectorPanel`; internal `patchMeta`, `toggleCharacter`. |
| `src/features/planning/Corkboard.tsx` | `Corkboard`; internal `addCard`, `handleDrop`. |
| `src/features/planning/OutlineView.tsx` | `OutlineView`; internal `handleDrop`. |
| `src/features/planning/TimelineView.tsx` | `TimelineView` — reading/date sorting and timeline rendering. |
| `src/features/planning/NodeBoard.tsx` | `NodeBoard`; internal `add`. |
| `src/features/planning/NotesPanel.tsx` | `extractComments`; `NotesPanel`; internal `addNote`. |
| `src/features/planning/CharacterManager.tsx` | `CharacterManager`; `CharacterDetail`; internal `add`, `save`, `addRel`, `updateRel`, `removeRel`. |
| `src/features/planning/LocationManager.tsx` | `LocationManager`; `LocationDetail`; internal `add`, `save`. |
| `src/features/planning/ThreadManager.tsx` | `ThreadManager`; internal `add`. |
| `src/features/planning/TrashView.tsx` | `TrashView`; internal `emptyTrash`. |
| `src/features/planning/SnapshotsPanel.tsx` | `SnapshotsPanel`; internal `take`. |
| `src/features/planning/VersionCompareDialog.tsx` | `VersionCompareDialog` — text diff/restore modal. |
| `src/features/planning/WorldbuildingManager.tsx` | `WorldbuildingManager`; `WorldDetail`; internal `add`, `save`. |
| `src/features/planning/WorldMapEditor.tsx` | `regionKind`; `markerKind`; `smoothClosedPath`; `centroid`; `pointInPolygon`; `clipHalfPlane`; `hexShade`; `dist2`; `WorldMapEditor`; internal `schedule`, `apply`, `setLive`, `pushHistory`, `edit`, `undo`, `redo`, `toMap`, `capture`, `release`, `zoomBy`, `fit`, `regionAt`, `onBgPointerDown`, `onPointerMove`, `onPointerUp`, `performCut`, `deleteSelected`, `recolorSelection`, `ToolBtn`, `IconBtn`, `renderMarker`, `exportMap`; `LegendGroup`; `LabelToggle`. |

### Editor

| File | Functions/components and role |
|---|---|
| `src/features/editor/DocumentEditor.tsx` | `wordAt`; `DocumentEditor`; internal `refreshSpell`, `replaceWordAt`, `addWordToDict`, `ignoreWord`, `openCommentDialog`, `addComment`, `buildContext`, `runTransform`, `applyReplacement`, `splitHere`, `onContextMenu`, `closeAll`, `findNameMatch`; `EditorStatusBar`. |
| `src/features/editor/extensions.ts` | `buildExtensions`. |
| `src/features/editor/editorActions.ts` | `chain`; `setTextType`; `activeTextType`; `toggleBold`; `toggleItalic`; `toggleUnderline`; `toggleStrike`; `toggleBulletList`; `toggleOrderedList`; `clearFormatting`; `setColor`; `setHighlight`; `setFontFamily`; `setFontSize`; `setAlign`; `setLineHeight`; `setSpacing`; `insertSceneBreak`; `setScriptElement`. |
| `src/features/editor/activeEditor.ts` | `setActiveEditor`; `getActiveEditor`; `subscribeActiveEditor`. |
| `src/features/editor/BlockStyle.ts` | `BlockStyle` extension, with `addOptions`, `addGlobalAttributes`, and command factory `addCommands`. |
| `src/features/editor/ScriptElement.ts` | internal `cycle`; `ScriptElementExt` extension, with `addGlobalAttributes` and `addKeyboardShortcuts`. |
| `src/features/editor/FocusBlock.ts` | `FocusBlock` extension with `addProseMirrorPlugins`. |
| `src/features/editor/CommentMark.ts` | `CommentMark` extension with `addAttributes` and `addCommands`. |
| `src/features/editor/SearchExtension.ts` | `findMatches`; `SearchExtension` with plugin state/apply/view/decoration/commands. |
| `src/features/editor/SpellcheckExtension.ts` | `scan`; `misspellingAt`; `Spellcheck` extension with state/apply/view/commands/onCreate/onDestroy. |
| `src/features/editor/EditorToolbar.tsx` | `Divider`; `EditorToolbar`. |
| `src/features/editor/Ribbon.tsx` | `Group`; `Ribbon`; `ColorMenu`. |
| `src/features/editor/BubbleToolbar.tsx` | `BubbleToolbar`; internal `Btn`. |
| `src/features/editor/SlashMenu.tsx` | `SlashMenu`; internal query/filter/keyboard handlers. |
| `src/features/editor/FindReplace.tsx` | `FindReplace`; internal search navigation and replace handlers. |
| `src/features/editor/EditorContextMenu.tsx` | `EditorContextMenu`; `Section`; `Row`; `Expand`; `IconBtn`; `Swatches`; `Chip`; `Label`; `Hint`. |
| `src/features/editor/CommentDialog.tsx` | `CommentDialog`. |
| `src/features/editor/SelectionResultDialog.tsx` | `SelectionResultDialog`. |

### Spellcheck, assistant, themes and export

| File | Functions/components and role |
|---|---|
| `src/features/spellcheck/spellService.ts` | `SpellService.onReady`, `isReady`, `syncUserWords`, `load`, private `_load`, `correct`, `suggest`, `addWord`, `ignore`; internal `blank`; exported `spellService`. |
| `src/features/spellcheck/SpellPopover.tsx` | `SpellPopover`. |
| `src/features/story-assistant/analyzeLocal.ts` | `tokenize`; `stripDialogue`; `detectPOV`; `detectNames`; `dialogueRatio`; `mattr`; `adverbInfo`; `pacingLabel`; `analyzeStory`. |
| `src/features/story-assistant/language.ts` | `synonymsFor`; `strongerWords`; `checkGrammar`; `simplify`; constants `THESAURUS` and `FILTER_WORDS`. |
| `src/features/story-assistant/lexicons.ts` | `forLang`; language lexicon tables and regexes. |
| `src/features/story-assistant/providers.ts` | `insight`; `lastSnippet`; `systemPrompt`; `contextBlock`; `block`; `localGenerate`; `localTransform`; `fetchWithTimeout`; `callOpenAI`; `callAnthropic`; `callGemini`; `callOllama`; `cloudTransform`; `getProvider`; exported `localProvider`. |
| `src/features/story-assistant/advancedAnalysis.ts` | `resolveDocKind`; `buildAdvancedMessages`; `parseAdvanced`; `runAdvancedAnalysis`; prompt/schema constants. |
| `src/features/story-assistant/AssistantPanel.tsx` | `fnv1a`; `AssistantPanel`; `Meter`; `Meters`; `ScoreBar`; `AdvancedResult`. |
| `src/features/story-assistant/Markdownish.tsx` | `inline`; `Markdownish`. |
| `src/features/themes/themes.ts` | `proseType`; `findBuiltin`; `BUILTIN_THEMES`; `DEFAULT_THEME_ID`. |
| `src/features/themes/applyTheme.ts` | `applyTheme`. |
| `src/features/themes/color.ts` | `hexToTriplet`; `tripletToHex`. |
| `src/features/themes/ThemePanel.tsx` | `ThemePanel`; `SliderRow`; `ThemeCard`. |
| `src/features/export/blocks.ts` | `runsFromInline`; `contentToBlocks`; `buildManuscript`. |
| `src/features/export/exporters.ts` | `buildCodex`; `codexMd`; `codexText`; `codexHtml`; `slug`; `esc`; `runsText`; `runsMd`; `runsHtml`; `blocksMd`; `toMarkdown`; `toPlainText`; `blocksHtml`; `bodyHtml`; `toHTML`; `toFountain`; `toDocxBlob`; `toEpubBlob`; `toProjectBackup`; `runExportNode`; `printViaIframe`; `runExport`. |
| `src/features/export/backup.ts` | `todayStamp`; `exportFullBackup`; `importBackup`. |
| `src/features/export/importDoc.ts` | `para`; `heading`; `textToBlocks`; `markdownToBlocks`; `docxToBlocks`; `importDocumentFile`. |
| `src/features/export/ExportDialog.tsx` | `ExportDialog`; internal `doExport`. |
| `src/features/updates/updateModel.ts` | `channelForVersion`; `initialUpdateState`; `updateReducer`; `isBusy`; `updateError`; `classifyUpdateError`; `describeStatus`; internal `comparePrerelease`-free pure transitions and `restingStatus`. |
| `src/features/updates/updateService.ts` | `useUpdates`; `checkForUpdates`; `downloadUpdate`; `installUpdate`; `downloadAndInstall`; `skipVersion`; `resetUpdateState`; `shouldNotify`; `initUpdates`; `updateDiagnostics`; `updatesSupported`; `refreshUpdateSupport`; `setUpdaterBackend`; `CHECK_FOR_UPDATES_EVENT`; internal `tauriBackend`, `releaseHeld`, `dueForAutomaticCheck`, `recordCheck`. |
| `src/features/updates/UpdatesSettings.tsx` | `UpdatesSettings`; `StatusIcon`. |
| `src/features/updates/UpdateNotice.tsx` | `UpdateNotice`. |

### Test-only symbols

`src/features/story-assistant/__tests__/accuracy.test.ts` contains the corpus
loader (`files`, `CORPUS`), `run`, `insight`, `tag`, `docOf`, `normPov`,
`mapPacing`, `nameSet`, `refMattr`, `predict`, `correct`, and `accuracyFor`,
plus the parameter/threshold tables. The test compares local analyzer results
with tagged corpus expectations.

The release/update suites are:

- `src/lib/__tests__/semver.test.ts` — SemVer ordering, pre-release precedence,
  and the fail-closed behaviour of `isNewerVersion`.
- `src/lib/__tests__/releaseManifest.test.ts` — manifest parsing and field-level
  errors, platform selection, endpoint placeholder resolution, and the
  publication checks.
- `src/lib/__tests__/pendingWrites.test.ts` — flush ordering, failure reporting
  and the hung-writer timeout.
- `src/features/updates/__tests__/updateModel.test.ts` — every state transition,
  including the illegal ones, downgrade refusal and error classification.
- `src/features/updates/__tests__/updateService.test.ts` — the whole flow
  against a fake updater backend (jsdom), including the guarantee that pending
  writes are flushed before install and that a failed flush cancels the update.
- `src/__tests__/releaseConfig.test.ts` — repository configuration invariants:
  identifier, updater key and endpoints, capabilities, bundle settings, workflow
  safety rules, and the absence of signing material.
