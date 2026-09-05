# Nest

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

- App shell with name + tagline
- Outline editor for headlines with TODO / DONE cycling
- Org priorities `[#A]` / `[#B]` / `[#C]` (cycle in outline + Today; rewrite .org)
- Org tags `:tag:` / `:tag1:tag2:` (chips add/remove; rewrite .org)
- Today filters by priority and/or tag (sticky via localStorage); sort A → B → C → none
- Capture parses `#A` / `[#B]` and trailing `:tag:` from the title text
- Inline title editing that writes back through uniorg stringify
- Raw source panel for direct .org text edits
- Capture appends TODO headlines (optional CREATED timestamp) to inbox.org
- Today view: open TODOs plus SCHEDULED / DEADLINE for today; Mark DONE writes back
- Seed fixtures in src/fixtures; web first load prefers /sample-inbox.org and /projects.org when localStorage is empty
- Browser localStorage persistence (Reset fixtures restores embedded seeds)
- Tauri 2 desktop shell with dialog folder picker, fs read/write, and remembered workspace path (plugin-store)
- Desktop: Capture / Today / editor persist to on-disk inbox.org and projects.org

## Stack

- Vite + TypeScript + React
- uniorg-parse / uniorg-stringify for Org AST round-trip
- Vitest for a small parse/stringify test suite
- Tauri 2 (optional desktop) with dialog, fs, and store plugins

## Limitations

Not Emacs Org parity:

- UI focuses on headlines, TODO/DONE, priorities, tags, planning timestamps, simple body text
- Drawers, clocks, links, tables, properties drawers UI are best-effort via source edits
- Tag filter is AND (item must have every selected tag); no full agenda / refile
- Title edits rebuild headline children as plain text
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

## License

MIT for Nest app code. uniorg packages are GPL-3.0-or-later.
