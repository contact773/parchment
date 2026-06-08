# Parchment — a writing studio for serious work

Parchment is a **local-first writing application** for novels, short stories, poetry,
screenplays, stage plays, TV episodes, essay collections, worldbuilding bibles and
general manuscripts. It aims to replace Word / Google Docs for creative writers by
combining the calm of a distraction-free editor, the structure of a manuscript binder,
multilingual spellcheck, a story-development assistant, deep theming and reliable exports.

Everything you write is stored privately in your browser (IndexedDB). No account, no cloud.

## Quick start

```bash
npm install         # installs deps and (via postinstall-style predev) copies dictionaries
npm run dev         # start the dev server  → http://localhost:5173
npm run build       # typecheck + production build into dist/
npm run preview     # preview the production build
npm run typecheck   # type-only check
npm run dict        # (re)copy Hunspell dictionaries into public/dictionaries
```

On first run, two sample projects are seeded (a literary-mystery novel and a thriller
screenplay) so you can explore immediately. Delete them any time.

## Feature map

- **Dashboard** — project cards with type, status, word count, target/progress, language,
  last-edited, daily-goal + streak widget, search, archive, duplicate, delete, import.
- **Editor** — TipTap/ProseMirror rich text: headings, bold/italic/underline/strike,
  highlight, lists, blockquote, alignment, scene breaks, inline comments, markdown
  shortcuts, undo/redo, word/char counts, reading time, page estimate, autosave, zoom,
  fullscreen/distraction-free, focus mode + typewriter mode, editable title.
- **Binder** — parts/chapters/scenes/sections/notes/research as a drag-and-drop tree with
  status dots, per-node word counts, rename, duplicate, add-inside, include/exclude compile.
- **Script mode** — screenplay element types (scene heading, action, character, dialogue,
  parenthetical, transition, shot) with Tab-to-cycle and Enter-to-flow, plus Fountain export.
- **Spellcheck** — nspell + Hunspell dictionaries for EN/NL/FR/DE/ES, per-project language,
  wavy underlines, suggestions popover, ignore word, personal dictionary. Pluggable
  `SpellProvider` so a server engine (e.g. LanguageTool) can slot in later.
- **Story Assistant** — local heuristic analysis (genre, tone, POV, protagonist/antagonist,
  pacing, dialogue balance, tension, unresolved threads, craft notes) + a chat that always
  offers multiple options and explains each option's narrative effect. Pluggable AI
  providers (OpenAI / Anthropic / Gemini / Ollama) configured in Settings — **no keys are
  hardcoded**; they live only in your local settings. Falls back to local on any error.
- **Planning** — corkboard, outline, character codex, location codex, plot-thread tracker,
  timeline, and a per-scene inspector (POV / goal / conflict / outcome / status / label).
- **Themes** — 9 built-in themes plus an unlimited custom-theme builder (all colors,
  fonts, size, line height, page width, paragraph spacing/indent, justify, radius,
  interface scale, sidebar density).
- **Export / import** — Word (.docx), PDF (print), Markdown, plain text, HTML, Fountain,
  ePub (foundation), and full JSON backup; import a full backup or a single project file.
- **Safety** — autosave, save indicator, snapshots (manual + automatic before restore),
  restore, survives refresh, one-click backup, "delete all" guarded danger zone.

## Architecture

```
src/
  components/        reusable UI (ui/: Button, Modal, Field, Menu, Auto, misc…), ErrorBoundary
  data/              db.ts (Dexie schema), repo.ts (all CRUD), seed.ts (samples)
  features/
    editor/          TipTap setup, toolbar, script + comment + focus extensions
    spellcheck/      spellService (nspell), ProseMirror decoration extension, popover
    story-assistant/ local analyzer, provider abstraction, panel, markdown renderer
    themes/          built-in themes, runtime applyTheme, theme builder, color utils
    export/          block model, exporters (md/txt/html/docx/pdf/fountain/epub/json), backup
    planning/        inspector, corkboard, outline, timeline, character/location/thread managers
    projects/        binder tree, node icons, new-project modal
    workspace/       topbar, left sidebar, right panel, goals widget
  hooks/             useApplyTheme
  lib/               text analysis, tree utils, constants, formatting, id, cn/debounce
  pages/             Dashboard, Workspace, SettingsPage
  store/             useSettings (persisted), useUI (transient)
  types/             the full data model
```

State: **Zustand** for settings/themes/dictionary/stats (persisted to localStorage) and
transient UI; **Dexie + dexie-react-hooks `useLiveQuery`** for reactive project content.

## Spellcheck dictionaries

Hunspell `.aff`/`.dic` files are copied from the `dictionary-*` packages into
`public/dictionaries/` by `scripts/copy-dictionaries.mjs` (run automatically before
`dev`/`build`). They are fetched lazily per language at runtime. Add a language by
installing its `dictionary-xx` package, adding it to `LANGS` in the copy script and to the
`LanguageCode`/`LANGUAGES` constants.

## Connecting an AI model (optional)

Settings → Story Assistant → choose a provider, enter a model id and (if needed) an API
key. Keys are stored only in your browser's localStorage. Note: direct browser→provider
calls can be blocked by provider CORS; on failure Parchment automatically uses the local
assistant.

## Known limitations / next steps

- Bundle is a single large chunk (editor + db); route-level code-splitting would trim it.
- Inline-comment editing/removal UI is minimal (view-only popover + Notes list).
- ePub export is a valid single-spine foundation, not chapter-split.
- Timeline is a reading-order view (no manual chronology/drag yet).
- No multi-user collaboration (by design — single-writer studio first).
- AI provider calls are best-effort from the browser; a tiny proxy would make them robust.
