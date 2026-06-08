# Parchment — Product Discovery & Research Synthesis

Synthesis of how writers actually use the major tools, their recurring complaints
(from reviews, writing forums, r/writing, r/Scrivener, r/Screenwriting, NaNoWriMo
threads, ProductHunt and app-store reviews), and what that means for Parchment.

## The competitive landscape — strengths & pain

| Tool | Loved for | Writers complain about |
|------|-----------|------------------------|
| **MS Word** | Ubiquity, track changes, DOCX is the submission standard | Terrible for long-form structure; one giant file; scrolling 120k words; no scene reordering; bloated |
| **Google Docs** | Real-time collab, autosave, free | Chokes past ~50–80k words; no project structure; weak offline; not built for fiction |
| **Scrivener** | The power tool — binder, corkboard, compile, research alongside text | *Steep learning curve*, dated UI, clunky sync, "compile" intimidates people, overkill for short work |
| **Ulysses / iA Writer** | Beautiful, calm, fast, markdown, focus modes | Too minimal for complex novels; weak planning; subscription resentment (Ulysses) |
| **Final Draft / Celtx** | Industry-standard screenplay formatting | Expensive, dated, Final Draft buggy; Celtx forced to cloud subscription |
| **Notion / Obsidian** | Infinitely flexible planning, linking, databases | Not real writing surfaces; performance; you *build a tool* instead of writing; export is poor |
| **Reedsy / LivingWriter / Dabble / Campfire** | Friendly, story-structure templates (beats, arcs), goals | Cloud-locked, subscription, can feel limiting; worldbuilding tools can become busywork |

## Recurring writer complaints → design imperatives

1. **"I just want to write without fighting the tool."** → A calm, fast, premium editor is the
   heart of the app. Everything else is a panel you can hide. Distraction-free + focus + typewriter modes.
2. **"My manuscript is one terrifying 100k-word file."** → First-class scene/chapter/part tree.
   Open one scene at a time; reorder by drag; see the whole book in the binder.
3. **"Scrivener is powerful but I gave up learning it."** → Progressive disclosure. Power features
   exist but are never in your face. Sensible defaults; nothing required to start writing.
4. **"I'm scared of losing my work."** → Local-first, autosave, explicit save indicator, snapshots,
   one-click JSON backup, survives refresh. Trust is the product.
5. **"Export is always a nightmare."** → Reliable Markdown/TXT/HTML/JSON always; DOCX (submission
   standard), PDF, EPUB foundation, Fountain for scripts.
6. **"I lose track of characters/timeline/plot threads."** → Lightweight planning: character &
   location codex, plot-thread tracker, corkboard, scene metadata (POV, goal, conflict, outcome, status).
7. **"Screenwriting tools are expensive and ugly."** → Built-in script element types (slug/action/
   character/dialogue/paren/transition) with keyboard-driven switching and Fountain export.
8. **"AI tools try to write *for* me / steamroll my voice."** → Assistant offers *multiple* options
   with the narrative effect of each, never one mandated direction. Analysis is read-only insight.
9. **"Spellcheck doesn't know my language / my invented words."** → Per-document language (NL/FR/EN/
   DE/ES), personal dictionary, ignore list, custom proper-noun friendliness.
10. **"Goals keep me writing."** → Daily word goal, session counter, project target, progress bars,
    session timer, streak foundation.

## Features that *sound* good but create clutter (deliberately deprioritized)
- Heavy real-time collaboration (this is a focused single-writer studio first).
- Mind-map canvases and infinite whiteboards (Milanote territory) — corkboard covers 90% of need.
- Gamified badges/social feeds — distracting for serious writers.
- Forcing a single story-structure methodology (Save the Cat etc.) — offered as optional templates, never mandatory.

## What writers use *daily* (must be frictionless)
Open project → open a scene → write → see word count tick → autosave → reorder a scene → jot a note →
check a character detail → set today's goal. These paths get the most polish.

## Spellcheck — feasible local-first approach
Browser `spellcheck` attribute gives no programmatic access to errors/suggestions. The strongest
practical local option is **nspell** (pure-JS, Hunspell-compatible) fed Hunspell `.aff`/`.dic`
dictionaries (`dictionary-en|nl|fr|de|es`), loaded lazily per language as static assets. Wrapped in a
`SpellProvider` abstraction so a server-side LanguageTool or richer engine can slot in later. Editor
integration via ProseMirror decorations (underline) + a suggestion popover, ignore list & user dictionary.

## Story assistant — feasible local-first approach
A `StoryProvider` interface with a **local rule-based/heuristic analyzer** (genre/tone signals, named
entities → characters, dialogue ratio → pacing, sentiment swing → emotional arc, unresolved-thread
heuristics) that works with zero configuration, plus pluggable cloud providers (OpenAI/Anthropic/Gemini/
Ollama) configured via Settings — **no secrets hardcoded**, keys live in local settings only.
