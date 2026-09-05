# Nest

**Org mode for people who won't install Emacs.**

Nest is a local-first starter for plain `.org` files in the browser. Week 1 focuses on a calm outline UI with a working **parse -> edit -> stringify** loop powered by uniorg.

No backend. No sync. No auth. No AI.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

```bash
npm run build
npm test
npm run preview
```

## What works (week 1)

- App shell with name + tagline
- Outline editor for headlines with TODO / DONE cycling
- Inline title editing that writes back through uniorg stringify
- Raw source panel for direct .org text edits
- Capture appends TODO headlines (optional CREATED timestamp) to inbox.org
- Today view: open TODOs plus SCHEDULED / DEADLINE for today; Mark DONE writes back
- Seed fixtures in src/fixtures so first load is useful
- Browser localStorage persistence (Reset fixtures restores seeds)

## Stack

- Vite + TypeScript + React
- uniorg-parse / uniorg-stringify for Org AST round-trip
- Vitest for a small parse/stringify test suite

## Limitations

Not Emacs Org parity:

- UI focuses on headlines, TODO/DONE, planning timestamps, simple body text
- Tags, priorities, drawers, clocks, links, tables are best-effort via source edits
- Title edits rebuild headline children as plain text
- Files live in memory + localStorage, not on disk
- No agenda beyond Today, no sync, auth, or AI

## Project layout

```
src/
  components/
  fixtures/
  lib/org.ts
  lib/org.test.ts
  App.tsx
```

## Publish

Created fresh (not cloned). Init git, commit, add the GitHub remote for rajeshsk76/nest, then publish.

## License

MIT for Nest app code. uniorg packages are GPL-3.0-or-later.
