# Nest — agent onboarding brief

Read this once at the start of a session, then `handoff_read` for current state.
`CLAUDE.md` (symlinked as `AGENTS.md` and `GEMINI.md`) holds the rules you must
follow. `docs/PLAN.md` holds the roadmap. This file explains *why* the rules
exist, so you do not argue with them or work around them.

---

## What Nest is

A local-first Org-mode editor. Tauri 2 + React + TypeScript. Real `.org` files
on disk. No backend, no sync, no auth, no database.

The product guarantee, in one sentence:

> **Bytes the user did not edit do not move.**

Everything in this repo exists to make that provable. It is not a preference or
a nice-to-have. It is the only thing Nest has that Emacs, organice, org-web,
Orgro and Logseq do not.

---

## The architecture, and why it is shaped this way

Nest originally parsed with `uniorg`, mutated the AST, and re-serialised the
whole file with `uniorg-stringify`. That meant one click rewrote bytes the user
never touched: tag padding collapsed, property-drawer alignment normalised,
`#+CAPTION:` and `#+NAME:` deleted outright, `#+BEGIN_SRC python -n :tangle
build.py` reduced to `#+begin_src python` with the tangle target silently gone.

That path is gone. The write path is now a **byte splice**:

1. `parseOrg(source)` parses with `trackPosition: true`, so every node carries
   `position.start.offset` / `position.end.offset`.
2. A mutator computes an `Edit { start, end, text }` for the span that changed.
3. `applyEdits(source, edits)` copies every byte outside those spans through
   with `source.slice`. Nothing is regenerated.
4. `changedRegions(before, after)` must return 1. `applyEdit` in `App.tsx`
   refuses the write otherwise and surfaces `RefuseWrite` to the status bar.

`stringifyOrg` still exists. It is **display-only** — the source panel and some
tests. If it appears anywhere in a write path, that is a bug, and
`check_invariants` will flag it.

Key symbols, all in `src/lib/org-core.ts`:
`applyEdits`, `RefuseWrite`, `changedRegions`, `headParts`, `headlineContext`,
`repadTags`, `spliceHead`, `todoKeywordsFrom`, `updateTodoInSource`.

---

## Three failures that already happened here

These are why the rules read as strictly as they do. Do not recreate them.

**1. A conformance script that tested nothing.**
`scripts/conformance-zero-edit.mjs` once contained:

```js
function zeroEditWrite(source) { return source; }
```

It reported `4/4 byte-identical (100.0%)`, `PASS >=95% gate`, and gated the
installer — without importing a single line from `src/`. It asserted that
returning the input returns the input. Reintroducing `stringifyOrg` on the write
path would not have moved the number.

*Rule that follows:* a conformance script must import from `src/lib/` and
exercise the real mutators. `check_invariants` enforces this.

**2. A test suite that only checked substrings.**
The compat test used `expect(out).toContain('* TODO [#A] Compat check :nest:ci:')`
on a six-line fixture that happened to round-trip cleanly. Byte equality was
never asserted anywhere.

*Rule that follows:* assert byte equality against real corpus files. Never
weaken an assertion to make code pass. No `it.skip`, no `describe.skip`.

**3. A pre-commit hook that was never executable.**
A6 shipped `.githooks/pre-commit` as a normal file. Git ignored it silently.
Every commit for days went in unchecked. It was armed only after a `chmod +x`
and `git config core.hooksPath .githooks`.

*Rule that follows:* a check you have never seen fail is not yet a check. Both
the gate and the hook have since been observed refusing a deliberately
sabotaged write path at 48.5%.

Separately, an agent twice overwrote `src/lib/org.ts` with a placeholder and had
to restore it from history. Stage named files. Never `git add -A`.

---

## Emacs is the oracle

`org-element.el` is the only specification Org has. There is no written grammar
to conform to — there is Emacs, and everything else is an approximation.

This matters because **byte fidelity is not correctness**. The clearest example:
marking a repeating task DONE preserved every byte and still produced the wrong
file.

```
Nest (before the fix):   * DONE Water the plants
                         SCHEDULED: <2026-09-08 Tue 14:00 +1w>

Emacs (org-todo "DONE"): * TODO Water the plants
                         SCHEDULED: <2026-09-15 Tue 14:00 +1w>
                         :LAST_REPEAT: [...]
```

`org-todo` on a repeater does not mark it done. It advances the timestamp,
resets the keyword, and logs `:LAST_REPEAT:`. Nest wrote DONE and left the date,
so a weekly habit marked done never recurred. No amount of byte checking finds
that. Only Emacs does.

Use the `emacs_oracle` tool for anything touching TODO state or timestamps.
Note `.+3d` advances from **today**, not from the stored date — that is the case
most implementations get wrong.

**Known, deliberate divergence:** Emacs re-aligns tags to `org-tags-column`
(`org-auto-align-tags` defaults to `t`). Nest preserves whatever padding it
finds, which is better for git diffs. Do not chase parity on this. An oracle
diff showing only tag padding is expected.

---

## Verification you must run

Exposed over MCP by `scripts/nest-mcp.mjs` (server name `nest`):

| Tool | What it does |
|------|--------------|
| `run_gate` | `npm run conformance:zero-edit` — real mutators over every corpus headline |
| `run_tests` | `vitest run` + `tsc -b` |
| `check_invariants` | stringify in write path, skipped tests, lowered gate, shadowing helpers, personal org files staged |
| `emacs_oracle` | Nest's mark-DONE vs Emacs `org-todo`, byte compared |
| `handoff_read` / `handoff_write` | the relay baton between agents |

All three of `run_tests`, `run_gate`, `check_invariants` must pass before any
commit. The pre-commit hook runs the gate independently. If a check fails,
**stop and report**. Do not adjust the check.

Baseline as of writing: gate 130/130 (100.0%), 9 test files green, `tsc -b`
clean, invariants clean.

---

## Trust boundary

Multiple agents work this repo in rotation (Claude Code, Codex, Gemini, Grok).
Work is not distributed evenly, because the risk is not distributed evenly.

**Write path — Claude only.** `org-core.ts` mutators, `applyEdits`,
`spliceHead`, `headlineContext`, `repadTags`, conformance scripts, existing
tests. This is where the guarantee lives, and the dangerous failure mode is an
agent weakening a check rather than fixing code.

**Any agent.** Read-only scrapes (`#+TAGS:`, `#+STARTUP:`), HTML export, docs,
README, UI copy, refusal wording, `nest.toml` config. Nothing here can break the
badge.

**Nobody, ever.** Modifying an existing test, script, fixture, or the `--gate`
value. Agents may *add* checks. Only the human removes one.

---

## Working agreement

- `handoff_read` first, `handoff_write` last. Every session.
- One commit per plan item. No amend, no force-push, no history rewrite.
- **Never push.** The human reviews every diff before it reaches the remote.
- Stage named files. `inbox.org` and `projects.org` in the repo root are the
  user's real tasks and are gitignored — never stage them.
- If you believe a rule is wrong, say so and stop. Do not route around it.

---

## Current position

Track A complete and verified: repeater semantics match Emacs on `+1w`, `++1m`,
`.+1d` and plain timestamps; table numeric right-alignment; real Emacs corpus
runner; GPL-3.0-or-later licence; pre-commit hook armed and observed blocking.

Next: Track B — B1 (`#+TAGS:` scrape) and B2 (`#+STARTUP:` scrape). Read-only.

See `docs/PLAN.md` for the full three-track plan and `HANDOFF.md` for live state.

---

## One thing to keep in mind

This is an off-hours passion project, not a startup. The reason the rules are
strict is not process for its own sake — it is that the author points Nest at
his own Org files. Every guarantee here is one he relies on personally.

Build carefully. When in doubt, refuse the write.
