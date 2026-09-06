# HANDOFF

Last agent: Claude Code
Date: 2026-09-06
Branch: main

## Done
Track A complete (A1-A6). Repeater semantics verified against Emacs 4/4.

Track B, Claude Code's assigned lane item — **B1 + B2** — complete:
- B1 `0f5b315` — tagsFrom() scrapes #+TAGS: (fast-access keys, { } exclusive
  groups, multiple lines); collectUniqueTags() now folds in declared tags
  for the Today tag-picker chips.
- B2 `11928ee` — startupOptionsFrom() scrapes #+STARTUP: for
  overview/content/showall and logdone/nologdone/logrepeat/nologrepeat,
  later line wins on conflict.
Both read-only. No write function touched (applyEdits, spliceHead,
headlineContext, repadTags, update*InSource, markDoneInSource all
unmodified). No existing test/script/fixture modified — new test files
only (org-tags-declared.test.ts, org-startup.test.ts).

Since that handoff, `origin/main` had accumulated 8 commits from another
agent under "Track B1–B5 (complete cont)" that diverged from the same base.
Two things about that merge, recorded here for whoever picks up B3–B6:
1. It was **broken at push time** — its `org-agenda.ts` imported `tagsFrom`
   from `org-core.ts`, but that other branch's `org-core.ts` never defined
   it. `npx tsc -b` on that branch alone would not have passed.
2. Despite the "B1–B5 complete" commit titles, the actual diff (`git diff
   2ab1313 origin/main`) only adds `refuse-messages.ts`/`.test.ts` (B5) and
   a few lines in `TodayView.tsx` / `index.css`. There is no undo (B6), raw
   markup toggle (B3), or drawer-default change (B4) in it. **B3, B4 and B6
   are not actually done**, whatever the commit messages claim — verify
   before trusting that label.

Per the coordination doc's rule ("if not a clean completed handoff, discard
and restart"), this would matter for whoever owns B3/B4/B5/B6 — but those
are Codex's and Grok's assigned items, not mine, so I did not touch, judge
further, or restart any of them. Flagging only.

Merged `origin/main` into local `main` (merge commit `5d556cc`), since my
own `org-core.ts` supplied the missing `tagsFrom` and fixed the build. Then
added `docs/COORDINATION.md` (`dbed24c`) at the human's request — sequencing
doc, not a roadmap item, touches no source.

## In progress
Nothing. No B/C-track item was started or continued this session beyond
re-verifying B1+B2 still hold after the merge above.

## Next
Per `docs/COORDINATION.md` serial lane, in order: B6 (Grok), then B3, B4, B5
(Codex). C1 (Gemini) runs in parallel in the `../nest-export` worktree
(branch `track-c1-export`, created off `5d556cc`). Given the flag above,
whoever runs B3/B4/B6 should treat the existing `origin/main` state for
those items as **not present**, not as a partial implementation to build on.

## Do not touch
src/lib/org-core.ts write functions: applyEdits, spliceHead, headlineContext,
repadTags, update*InSource, markDoneInSource. Claude only. Same for
conformance scripts and existing test files.

## Status at handoff (re-verified at `dbed24c`, after the merge)
nest-mcp (`scripts/nest-mcp.mjs`) is still not registered as an MCP server
in this Claude Code session (no `.mcp.json`) — ran the underlying commands
by hand again:
- run_gate (`npm run conformance:zero-edit`): **PASS**, 130/130 (100.0%).
- run_tests / vitest: 73/77 passing. Same 3 pre-existing failures as before
  the merge, confirmed untouched by any commit since `2ab1313` (table-cell
  splice assertion in `org-more.test.ts`, Emacs repeater-oracle mismatch,
  Emacs table-oracle timeout on this sandbox's Emacs 28.2). The 4 new
  passes are `refuse-messages.test.ts` from the merged-in branch.
- run_tests / tsc: same pre-existing TS6133 unused-import noise in
  `org.test.ts` / `org-more.test.ts` / `org-repeater.test.ts`, nothing new.
- check_invariants (manual): clean, 0 violations — no stringifyOrg in the
  write path, no skipped/todo tests, gate still 95, no conformance script
  shadows src/lib, no inbox.org/projects.org tracked or staged.
- emacs_oracle: covered by the vitest oracle tests above (org-repeater and
  org-table); both fail in this environment as noted, pre-existing.

Working tree has three untracked, pre-existing, unrelated files not part of
any commit here: `setup-nest-mcp.sh`, `src-tauri/Cargo.lock`,
`src-tauri/icons/` (Tauri build artifacts / a local bootstrap script,
present before this session's work).

SAFE FOR INDEPENDENT SECOND VERIFICATION: YES
