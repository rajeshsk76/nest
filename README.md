# Nest

[![CI](https://github.com/rajeshsk76/nest/actions/workflows/ci.yml/badge.svg)](https://github.com/rajeshsk76/nest/actions/workflows/ci.yml)

**Org mode for people who won't install Emacs.**

Nest is a local-first starter for plain `.org` files. Week 1 shipped a calm outline UI with a working **parse -> edit -> stringify** loop. Week 2 adds an optional Tauri desktop shell so Capture and Today read and write real `.org` files on disk.

No backend. No sync. No auth. No AI.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 (Vite binds 0.0.0.0:5173 with strictPort). The dev script uses a small restart wrapper so the server stays up if Vite exits unexpectedly.

On install / before dev / preview, Nest auto-creates sample org files under data/ and mirrors them into public/ so the app can fetch them. Existing non-empty files are left alone. Open data/sample-inbox.org and data/projects.org in Emacs if you want to edit the seeds on disk.

```bash
npm run build
npm test
npm run preview
```

## Desktop (Tauri)

Nest V2 can run as a native desktop app. A real folder on disk is the source of truth — no browser file-permission prompts.

### Rust prerequisites

Install a recent Rust toolchain (rustup) plus platform dependencies for Tauri 2:

- Linux: webkit2gtk, librsvg, and usual build tools (see Tauri 2 prerequisites docs)
- macOS: Xcode CLT
- Windows: MSVC build tools + WebView2

Verify with rustc and cargo (rustup stable; recent crates may need 1.88+).

### Run the desktop app

1. Install JS deps with the project package manager.
2. Start the desktop shell via the tauri:dev script.
3. Optionally produce a production bundle via the tauri:build script.

```bash
npm install
npm run tauri:dev
npm run tauri:build
```


This starts Vite and opens the Nest window. On first launch (or when no folder is remembered), Nest asks you to pick a folder via the native dialog. If you cancel, it creates a default folder under the app data directory and seeds inbox.org / projects.org from src/fixtures. If sample-inbox.org exists and inbox.org does not, Nest migrates the sample to inbox.org.

Use Open folder / Change folder in the UI to point Nest at another directory. Capture appends to on-disk inbox.org; Today Mark DONE and editor/source edits rewrite the matching file.

### Web vs desktop

- Web (dev script): memory + localStorage; fixtures / public samples on first load. No folder picker.
- Desktop (tauri:dev): real .org files in a chosen folder; native dialog + Tauri fs plugin; path remembered via plugin-store.

Browser mode remains fully supported for UI work without Rust.

## What works

- App shell with name + tagline; calm empty-state onboarding when no headlines
- Outline editor for headlines with TODO / DONE cycling
- Org priorities `[#A]` / `[#B]` / `[#C]` (cycle in outline + Today; rewrite .org)
- Org tags `:tag:` / `:tag1:tag2:` (chips add/remove; rewrite .org)
- Today sticky priority badges + tag chips for filtering; sort A → B → C → none
- Capture parses `#A` / `[#B]` and trailing `:tag:` from the title text
- Elegant markup in the outline (display only): *bold* /italic/ _underline_ +strike+ =verbatim= ~code~, clickable [[url][label]] / [[url]]; raw markers stay in the source panel and on disk; idle outline / Today titles render markup by default (raw only while editing)
- File-level Org scrape: `#+TAGS:` / `#+FILETAGS:` suggest tags in the picker and Today chips; `#+STARTUP: overview` folds the outline by default; `logdone` / `logrepeat` are read and exposed (Nest does not write Emacs state logs yet)
- `:PROPERTIES:` / `:LOGBOOK:` drawers stay out of the outline body (source panel still shows full bytes)
- Calm plain-English status when Nest refuses an unsafe edit (technical detail in the console)
- Structural editing: fold/unfold subtree (Tab / chevron — visibility only, no disk write); promote/demote stars; move subtree among siblings; insert same-level heading — all structure writes are byte-splice
- Transparent tables: detect `| col | col |` blocks; edit cells in the outline; Tab between cells; add row — rewrites only the table region (Emacs-aligned pipes)
- Source blocks: detect `#+BEGIN_SRC lang` … `#+END_SRC`; language badge + monospace editable body; rewrites only the interior (fences stay valid Org); never execute / tangle / Babel
- Export HTML: one-file Org → HTML (headlines, lists, emphasis, links, tables, src as `<pre><code>`); downloads `inbox.html` / `projects.html`; on desktop also writes a sibling `.html` beside the `.org` — never replaces the `.org`
- Inline title editing (click to edit raw Org; caret-stable) that byte-splices the title when you change it
- Raw source panel for direct .org text edits
- Capture appends TODO headlines with CREATED properties drawer (always on) to inbox.org
- Today view: open TODOs plus SCHEDULED / DEADLINE for today; Mark DONE writes back
- Seed fixtures in src/fixtures; web first load prefers /sample-inbox.org and /projects.org when localStorage is empty
- Browser localStorage persistence (Reset fixtures restores embedded seeds)
- Tauri 2 desktop shell with dialog folder picker, fs read/write, and remembered workspace path (plugin-store)
- Desktop: Capture / Today / editor persist to on-disk inbox.org and projects.org

## Emacs oracles (Track A)

Nest treats Emacs as the Org oracle for repeater Mark DONE and numeric table alignment.

Locally (requires `emacs` / `emacs-nox` on PATH — proven with GNU Emacs 30.1):

```bash
npm run test:emacs-oracle
npm run test:emacs-table-oracle
npm run conformance:emacs-corpus
```

CI (`.github/workflows/ci.yml`) installs `emacs-nox` on `ubuntu-latest`, runs unit tests, both oracles, and the corpus runner. Missing Emacs fails closed (non-zero exit) — never skips green.

Corpus fixtures: `fixtures/emacs-corpus/repeater-mark-done.org`, `fixtures/emacs-corpus/numeric-table.org`.

## Stack

- Vite + TypeScript + React
- uniorg-parse / uniorg-stringify for Org AST round-trip
- Vitest for parse/stringify + Org compat round-trip (CI badge)
- Tauri 2 (optional desktop) with dialog, fs, and store plugins

## Limitations

Not Emacs Org parity:

- UI focuses on headlines, TODO/DONE, priorities, tags, planning timestamps, simple body text, Org tables, and source blocks
- Drawers, clocks, properties drawers UI are best-effort via source edits; outline hides PROPERTIES/LOGBOOK by default (Track B4); emphasis + links for display
- Tables: no nested tables, no spreadsheet / TBLFM editing (existing #+TBLFM lines are preserved)
- Tag filter is AND (item must have every selected tag); no full agenda / refile
- Title edits splice title bytes; display markup is parse-for-display only (not a structural rewrite)
- Fold is UI visibility only; promote/demote/move/insert splice stars or section spans (refuse if unsure)
- Table cell/row edits splice only that table’s byte span (aligned); refuse pipes/newlines in cells
- Src body edits splice only the interior between fences; refuse bodies that inject `#+END_SRC`; no execution
- Export is a pure read of Org → new HTML file only (no Reveal slides in this slice)
- Web: files live in memory + localStorage (sample files under data/ / public/ are seeds only)
- Desktop: .org files on disk are authoritative; sync/multi-device is out of scope
- No agenda beyond Today, no sync, auth, or AI

## Project layout

```
data/                 # auto-created sample .org files (edit in Emacs)
public/               # mirrored samples for fetch on first load
scripts/
  ensure-sample-orgs.mjs
  dev.mjs             # Vite stay-alive wrapper
src/
  components/
  fixtures/
  lib/org.ts
  lib/org.test.ts
  lib/workspace.ts    # Tauri disk folder I/O
  App.tsx
src-tauri/            # Tauri 2 shell (Rust)
```

## Publish

Created fresh (not cloned). Init git, commit, add the GitHub remote for rajeshsk76/nest, then publish.

## Git hooks

`prepare` sets `core.hooksPath` to `.githooks` so a normal install enables the local pre-commit gate. The hook runs `conformance:zero-edit` and fails closed (non-zero exit) if the gate fails.

## License

Nest is licensed under GPL-3.0-or-later (see `LICENSE`). uniorg packages are also GPL-3.0-or-later — Nest and its Org deps now align.
