# HANDOFF

Last agent: Claude Code
Date: 2026-09-06
Branch: main

## Done
Track A complete (A1-A6). Repeater semantics verified against Emacs 4/4.
Track B complete (B1-B2):
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

nest-mcp verification server added (`scripts/nest-mcp.mjs`) but not yet
registered as an MCP server in this Claude Code session (no .mcp.json
found) — its checks were run by hand instead (npm run
conformance:zero-edit, npx vitest run, npx tsc -b, and the same static
scans check_invariants performs). check_invariants equivalent: clean,
0 violations.

## In progress
nothing

## Next
Track C (unplanned as of this handoff) or continued polish per PLAN.md.
Whoever picks this up: register nest-mcp as an MCP server (`claude mcp
add`) so run_tests/run_gate/check_invariants/handoff_read/handoff_write
are callable directly instead of by hand.

## Do not touch
src/lib/org-core.ts write functions: applyEdits, spliceHead, headlineContext,
repadTags, update*InSource, markDoneInSource. Claude only.

## Status at handoff
gate: 130/130 (100.0%) | tsc: TS6133 unused-import noise in
org.test.ts/org-more.test.ts/org-repeater.test.ts (pre-existing, predates
Track B, confirmed via git stash against 2ab1313) | vitest: 70/74 passing —
3 pre-existing failures unrelated to Track B (a table-cell splice assertion
in org-more.test.ts, an Emacs repeater-oracle mismatch, an Emacs
table-oracle timeout in this sandbox's Emacs 28.2) | Track B's own new
tests: all passing.
