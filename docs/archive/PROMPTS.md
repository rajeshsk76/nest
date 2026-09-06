> **Superseded, kept for history. Do not build from this file.**
>
> It describes the pre-splice architecture — `uniorg-parse / uniorg-stringify`
> round-tripping the whole file — which is exactly the write path that was
> removed. It also gives `npm test` as the bar; that no longer covers the
> Emacs oracles (`npm run test:all` does).
>
> Current rules are `CLAUDE.md`, reasons `docs/CONTEXT.md`, plan
> `docs/PLAN.md`, features `docs/FEATURES.md`, lanes `docs/COORDINATION.md`.

# Nest — ten-slice build prompts

Calm Nest voice. One slice at a time. Ship, test, Emacs smoke check, then stop.

**Rules for whoever runs these prompts**

- Start **only one** slice per session.
- Stop after that slice: `npm test` green, verify in the app, open the fixture in Emacs.
- Do **not** begin slice N+1 until slice N is done.
- Prefer shrinking a slice over breaking the `.org` round-trip.

Copy from START PROMPT to END PROMPT into a coding agent when you want the full map. Then ask for **one** slice only (e.g. "Slice 1 only").

---

START PROMPT
You are building Nest (repo: rajeshsk76/nest).
One-liner: Org mode for people who won’t install Emacs.
Source of truth: plain .org files on disk (Tauri). Web mode is UI-only.
Stack: Vite + TypeScript + React + uniorg-parse / uniorg-stringify + Tauri 2.
License: MIT for Nest code. Do not break the parse → edit → stringify loop.
Hard rules
Files the user owns. Never invent a Nest-only format.
Byte-splice writes for routine edits (TODO/DONE, title, tags, planning). Do not regenerate the whole file through stringify unless the user is in the raw source panel.
Every feature must make Capture or Today stickier, or protect the .org round-trip.
If unsure whether an edit would smash drawers, clocks, repeaters, or unknown syntax: refuse the structural write and leave the bytes alone.
No backend, no cloud sync, no auth, no AI that owns the file.
After each slice: npm test must pass. Open the same file in Emacs and confirm it still looks like Org.
Only start one slice at a time. Stop after each. Do not start slice N+1 until slice N has tests and an Emacs smoke check.
Already shipped — do not rebuild
Outline headlines, TODO/DONE cycle
Priorities [#A/B/C], tags :tag:
Capture → inbox.org with CREATED drawer
Today view (SCHEDULED / DEADLINE + open TODOs), Mark DONE
Tauri folder picker, on-disk inbox.org / projects.org
Raw source panel
Slice 1 — elegant markup (display only)
Slice 2 — structural editing (fold view-only; promote/demote/move/insert splice) — shipped
Slice 3 — transparent tables — shipped
Slice 4 — superior source code — shipped
Slice 5 — export and publish — shipped
Build all 10 pillars as sequential slices. Ship one slice, test, then the next. Do not start slice N+1 until slice N has tests and an Emacs smoke check.
Slice 1 — Elegant markup
Render in the outline (display only; disk stays raw Org):
*bold* /italic/ _underline_ +strike+ =verbatim= ~code~
Links [[url][label]] and [[url]] — clickable in UI, bytes unchanged
Keep raw markers in the source panel
Done when: a fixture with mixed emphasis + a link renders in the outline and stringify leaves the file byte-identical if the user did not edit those spans.
Slice 2 — Structural editing ✅ shipped
Tab / click: fold and unfold a headline subtree (visibility only — no file write)
Promote / demote: change star count on the current headline and its children
Move subtree up / down among siblings
Insert heading (same level) without destroying body/drawers
Done when: fold does not write disk; promote/demote/move go through byte-splice; Emacs still folds the same tree.
Slice 3 — Transparent tables ✅ shipped
Detect | col | col | blocks
Edit a cell in UI; rewrite only that table region
Tab between cells; add row
No nested tables. No spreadsheet formulas in this slice
Done when: editing one cell does not reorder unrelated headlines; Emacs table still aligns.
Slice 4 — Superior source code ✅ shipped
Detect #+BEGIN_SRC lang … #+END_SRC
Show language badge + monospace body
Syntax highlight in UI if cheap; never execute code
Tangle / Babel eval is out of scope
Done when: editing the body rewrites only the block; fences stay valid Org.
Slice 5 — Export and publish ✅ shipped
One-file export: Org → HTML (headlines, lists, emphasis, links, tables, src as <pre>)
Optional Reveal-style slides from headlines (template later)
Export writes a sibling file next to the .org; never replaces the .org
Done when: HTML opens in a browser; original .org unchanged.
Slice 6 — Take control of tasks
Cycle TODO keywords: TODO → DONE → TODO (keep existing)
Add NEXT / WAIT as optional keywords only if #+TODO: is present in the file
Priority cycle and tag chips already exist — keep them
SCHEDULED / DEADLINE picker that writes real Org timestamps <YYYY-MM-DD Day>
Done when: picker writes Emacs-valid stamps; Mark DONE still byte-splices.
Slice 7 — Actionable agenda
Keep Today as the home screen
Add a 7-day strip under Today (not full Org agenda, no sparse trees, no column view)
Click a day to filter that date’s SCHEDULED / DEADLINE
Done when: strip is derived from on-disk files; no extra database.
Slice 8 — Clocking
Clock in / Clock out on the current headline
Write CLOCK: [start]--[end] => HH:MM under the heading (or a LOGBOOK drawer if one already exists)
Show a simple sum for today
Do not invent a new time format
Done when: Emacs org-clock-in style lines parse; Nest does not smash an existing LOGBOOK.
Slice 9 — Capture from anywhere
Keep the Capture bar (hotkey → inbox)
Add two templates: plain TODO, and TODO with SCHEDULED=today
Templates are Org text, stored as .org snippets on disk, not a proprietary schema
Done when: one keystroke appends a valid headline + CREATED drawer to inbox.org.
Slice 10 — Extremely extensible
Do not build a plugin marketplace
Add a documented hook: custom link type prefix (e.g. issue:123) resolves via a small JS map in repo config
Custom TODO workflows already covered by #+TODO:
Leave the door open: templates folder + one README section “add a template”
Done when: a custom link renders as a label in the UI and still opens as raw Org in Emacs.
Implementation notes
Prefer extending src/lib/org.ts + tests in src/lib/org.test.ts
UI in existing src/components/ — calm, whitespace, monospace accents, no neon
Desktop writes go through src/lib/workspace.ts
Update README “What works” and PLAN.md after each slice
If a slice fights the round-trip, shrink the slice. Integrity beats features.
Slices 1–5 shipped. Start with Slice 6 next. After a slice passes tests, stop and show: files changed, how to verify in the app, and the Emacs check.
END PROMPT

