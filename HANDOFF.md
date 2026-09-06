# HANDOFF

Last agent: Claude Code (search lane)
Date: 2026-09-06
Branch: track-search
HEAD: 311e2c4 (pushed to origin/track-search; NOT merged to main)

## Verified baseline at HEAD

```
npm run test:all       91/91 + 2/2 (incl. Emacs oracles)
npx tsc -b             clean
conformance:zero-edit  130/130 (100.0%)
check_invariants       CLEAN
```

## Done

- **`org-search.ts`** `3f4b4c4` — new file, library only, no UI/App.tsx.
  `searchHeadlines`, `parseTagQuery`, `filterHeadlines`. See prior handoff
  entry for the original design notes (FILETAGS scraping, ancestor-stack
  tag inheritance, special-property fallback for `PROP="value"` clauses).

- **Property-drawer fix** `311e2c4` — review caught that `matchesProp` only
  checked Org's special properties (TODO/PRIORITY/TAGS/etc.), so a real
  `:PROPERTIES:` entry like `:CLIENT: acme` was invisible: `CLIENT="acme"`
  matched nothing, `CLIENT<>"acme"` wrongly matched everything.
  - `SearchHit` gained `props: Record<string, string>`, populated per
    headline from its own drawer in the same tree walk that already
    collected body text (`collectSectionData`, replacing the old
    `collectBodyText`).
  - `matchesProp` now checks the drawer first (case-insensitive key via
    `drawerPropValue`), falling back to `specialPropValue` only when the
    key isn't a real drawer entry.
  - Added 3 tests: drawer `=` match, drawer `<>` correctly excluding, and
    a property clause against a headline with no drawer at all (11 tests
    total in the file now).
  - Drawer properties are read from the headline's own drawer only — no
    inheritance from ancestor properties. Not asked for; flag if it comes
    up later.

Both commits pushed to `origin/track-search` as fast-forwards. **Not
merged to main** — that's the human's call per the coordination protocol.

## Lanes / push protocol (unchanged from prior handoff)

Two agents were running concurrently:

| Agent | Tree | Item |
|---|---|---|
| Codex | `~/nest` | B6 undo, then B3, then B4 |
| Claude Code | `~/nest-search` (this one) | `org-search.ts` — **done, reviewed, fixed, pushed** |

`origin/main` has already moved to `f5d8727` ("PLAN: B3 and B4 were never
shipped") — ahead of the `687fa6e` this branch was cut from. `track-search`
has **not** been rebased onto that; only asked to push the branch itself,
not touch main. Whoever merges `track-search` should rebase it onto current
`origin/main` first and re-verify (`test:all`, `tsc -b`,
`conformance:zero-edit`) after the rebase, since a rebase can silently
reintroduce a stale gate result.

## Next after Track B

Unchanged: B3, B4, B6, C1, then the checkbox group (see `docs/FEATURES.md`
and the prior handoff entry for the four Emacs-verified cookie rules).

## Known weak spot (unchanged)

`opts.maxRegions` in `App.tsx` — still there, still a good filler item once
`markDoneInSource` migrates to `SpliceResult`.
