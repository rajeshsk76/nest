# HANDOFF

Last agent: Claude (review lane)
Date: 2026-09-06
Branch: main
HEAD: 760ed49

## Verified baseline

Independently re-derived from a clean clone at `760ed49`:

```
npm run test:all      80/80 + 2/2
npx tsc -b            clean
conformance:zero-edit 130/130 (100.0%)
emacs oracles         both PASS standalone
check_invariants      CLEAN
```

`npm test` alone no longer covers the Emacs oracles — use `test:all`.
Any red you see is yours.

## Done

- **Track A** (A1–A6). Repeater semantics match Emacs on `+1w`, `++1m`,
  `.+1d` and plain timestamps. Table numeric right-align. GPL-3 licence.
  Pre-commit hook armed and observed refusing a sabotaged write path at 48.5%.
- **B1** `0f5b315` — `tagsFrom()` scrapes `#+TAGS:` (fast-access keys,
  `{ }` exclusive groups, multiple lines); declared tags feed the tag picker.
- **B2** `11928ee` — `startupOptionsFrom()` scrapes `#+STARTUP:`
  (overview/content/showall, logdone/nologdone/logrepeat/nologrepeat).
- **B5** — `refuse-messages.ts`, plain-language refusal copy.
- **Span guard** `760ed49` — `applyEditsTracked` / `assertOnlySpansChanged`.
  Prerequisite for checkboxes. Mutators may declare exactly which byte ranges
  they touched; the guard rebuilds the result and refuses anything that moved
  outside them. Strictly stronger than the region count.
- **Oracle scratch** `965e4bc` — oracle temp files live in `.nest-tmp/` inside
  the repo. They previously used the system temp directory, which sandboxed
  agents deny with EPERM, producing a red baseline unrelated to the code.
- **Docs** `a136fca` — `docs/CONTEXT.md`, `docs/FEATURES.md`, `docs/PLAN.md`.
  These were referenced by every agent brief for days and did not exist.

## Unstarted, despite the commit log

Seven commits on `origin/main` are titled `Track B1–B5 (complete)`. Grepping
the tree, only B5 shipped. **B3, B4 and B6 do not exist.** Do not assume any
of them is partially done; start each fresh.

- **B3** raw markup toggle, off by default
- **B4** `:PROPERTIES:` / `:LOGBOOK:` drawers collapsed by default
- **B6** one-level undo

Also unstarted: `org-search.ts` (a previous agent stopped at its usage limit
during orientation, nothing committed) and C1 HTML export.

## Lanes

Two agents. One item each, verified before the next starts.

| Agent | Tree | Item |
|---|---|---|
| Codex | `~/nest` | B6 undo, then B3, then B4 |
| Claude Code | `~/nest-search` | `org-search.ts` |
| Claude (review) | — | write path, scripts, existing tests, second verification |

Worktrees `~/nest-search` (branch `track-search`) and `~/nest-export`
(branch `track-c1-export`) exist and are rebased on `origin/main`.

## Next after Track B

The checkbox group — the largest Tier 1 gap. Nest cannot tick a box: no
`[ ]`/`[X]` toggle, no `[/]` or `[%]` cookies, no list item editing.

Four rules, verified against Emacs 29.3. Get these wrong and the file
disagrees with Emacs on every partial list:

1. State propagates all the way up; cookies count **direct children only**.
2. `[X]` when all direct children are checked, `[-]` when some are.
3. Toggling a parent that has children does nothing — its state is derived.
4. A headline cookie works with no list cookie present.

The mutator returns `SpliceResult` declaring every touched span: the box,
each ancestor's state, each ancestor cookie. Ships with a `checkbox-toggle`
conformance check and an Emacs oracle case in the same commit.

## Known weak spot

`opts.maxRegions` in `App.tsx` — a dial added once to fit the repeater.
Migrating `markDoneInSource` to return `SpliceResult` removes the need for it
and tightens the guard. Good filler item.
