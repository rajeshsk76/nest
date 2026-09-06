# Roadmap

## North star

Org mode for people who will not install Emacs. Plain .org files you own. Capture and Today first.

## Shipped

- Web — Vite + React outline, uniorg round-trip, Capture, Today
- Desktop — Tauri 2, folder on disk as truth
- Tags and priorities — [#A/B/C], :tag:, Today filters + sort
- V2.2 habit polish — caret-stable titles; CREATED on every capture; sticky Today chips; Org round-trip CI badge; empty-state onboarding
- Ops — auto-seed sample orgs; free port 5173

## Next

Calendar sync is deferred. Next habit/coexistence items:

1. **Byte-splice writes** — MVP shipped for TODO/DONE mark-done; extend to title/tags/planning; repeater DONE shipped (Track A.1); table numeric right-align shipped (Track A.2)
2. SCHEDULED / DEADLINE picker polish (partial already); repeater DONE shipped (Track A.1)
3. Reload on external edit
4. 7-day agenda strip
5. Refile inbox to projects

## Later maybe

Harder round-trip tests; open in Emacs; git status badge; icons.

## Not on the map

- Full Org agenda, sparse trees, column view
- Babel, publish, org-roam
- AI that owns files
- Calendar sync (explicitly deferred)
- **Pro sync / paid sync / cloud sync** — deleted from the roadmap. Sync contradicts the local-files pitch (disk `.org` you own; no Nest-hosted source of truth).

## Conformance

Org integrity is a product gate, not a nice-to-have.

- **Byte-splice required** for edits: change only the bytes that must change; do not regenerate the whole file through parse → stringify for routine writes (Mark DONE, title, tags, planning).
- **Installer gated** on ≥95% byte-identical zero-edit saves (parse/load/save with no intentional mutation must leave the file unchanged for that share of a public corpus).
- **Public `emacs --batch` corpus (Track A.4)** — `conformance:emacs-corpus` runs repeater + numeric-table fixtures vs Emacs (`emacs-nox` in CI); fail-closed if emacs missing.
- Falsification (`docs/falsification-repeater.md`): Mark DONE **byte-splice PASS** (file integrity); repeater DONE **semantics PASS** vs Emacs (test:emacs-oracle). Table numeric align **PASS** vs Emacs (test:emacs-table-oracle; Track A.2). Zero-edit gate via conformance:zero-edit (>=95%, includes table-numeric-align). Corpus gate: conformance:emacs-corpus (Track A.4).

## Rule

Every feature must make Capture or Today stickier, or protect the .org round-trip.
