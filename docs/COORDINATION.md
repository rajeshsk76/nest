# Nest — coordination

How work is divided across agents and in what order. Rules live in `CLAUDE.md`,
reasons live in `docs/CONTEXT.md`, the roadmap lives in `docs/PLAN.md`, live
state lives in `HANDOFF.md`. This file is the sequencing.

---

## Two constraints shape everything

**File collisions.** B1/B2, B3–B5 and B6 all touch `App.tsx` and the editor
components. Only C1 export is a new module that collides with nothing.
Serialise everything that edits `App.tsx`; run C1 in parallel.

**Review is the bottleneck, not generation.** Track A landed in a day. Four
agents running loose produce faster than anyone can check. One item per push,
verified before the next starts.

---

## Lanes

### Serial lane — `App.tsx` and components, one agent at a time

| Order | Item | Assigned | Touches write path |
|-------|------|----------|--------------------|
| 1 | B1 + B2 — `#+TAGS:` / `#+STARTUP:` scrapes | done `0f5b315` `11928ee` | no |
| 2 | B6 — one-level undo | Codex | no |
| 3 | B3 — raw markup toggle, off by default | Codex | no |
| 4 | B4 — drawers collapsed by default | Codex | no |
| 5 | B5 — plain-language refusal messages | done | no |

Whoever has credits takes the next item. The order matters more than who runs
it. B6 sits before B3–B5 deliberately: undo is what changes how the app feels,
and it should be in place before serious dogfooding starts.

### Parallel lane — new module, no collisions

| Item | Assigned | Touches write path |
|------|----------|--------------------|
| C1 — Org to HTML export | unassigned | no |

Runs from day one in a separate worktree. Should touch only new files plus one
import.

### Reserved

Anything near `applyEdits`, `spliceHead`, `headlineContext`, `repadTags`, the
`update*InSource` mutators, conformance scripts, or existing tests is **Claude
only**, per the trust boundary in `docs/CONTEXT.md`. No exceptions, including
for a one-line fix that "obviously" cannot break anything.

---

## Parallel work without collisions

```bash
git worktree add ../nest-export -b track-c1-export
```

Gemini works in `~/nest-export`; everyone else in `~/nest`. The MCP server path
works from either. Merge C1 once reviewed.

Never run two agents in the same working tree.

---

## The loop, per item

1. Agent calls `handoff_read`, does exactly one item, runs `run_tests`,
   `run_gate` and `check_invariants`, commits, calls `handoff_write`.
2. Human reads the diff — **especially anything under `scripts/` or
   `*.test.ts`**. Feature code the tests cover; the tests themselves nobody
   covers but the human.
3. Human pushes.
4. Second verification: pull, run gate, tests, invariants and `emacs_oracle`,
   report whether the check got stricter or the code got looser.
5. The next item starts only after step 4.

Step 5 is the discipline. Two items in flight means a failure in the first
contaminates the second, and you are bisecting across two agents' work.

---

## Cadence

One item per session, one session per evening. The serial lane plus C1 is
roughly a week and a half at that rate — a realistic shape for off-hours work
alongside a day job.

**Friday:** cut a build and use it on real Org files over the weekend with
`git diff` running after each session. That is the check no agent can perform.
Any diff that was not intended is a bug filed that night.

---

## Handoff discipline

`HANDOFF.md` is the relay baton. Every agent reads it first and writes it last.
It records: what was finished with commit SHAs, what is in progress, what is
next, what must not be touched, and gate and test status at handover.

**Never hand over mid-item.** If credits run out partway through, the next
agent's first action is `git checkout .` and a fresh start on that item — not
"continue what the last one was doing." A half-finished change picked up by a
different model is how files get corrupted.

---

## What ends this phase

Track B complete and C1 merged. Then stop and reassess before C2 (MCP write
tools) or C4 (signed installer).

By then there will be enough real use to know whether the non-coder surface
actually works. That should decide what comes next — not the roadmap deciding
in advance.

---

## Rules learned the hard way

Each of these cost an evening. They are not style preferences.

**A commit message may not claim a plan item is complete.** `HANDOFF.md`
records completion, and only after a human has confirmed the behaviour exists
in the working tree. Seven commits titled `Track B1-B5 (complete)` shipped one
of five items. Run `git show --stat HEAD` after every commit and confirm the
diff matches what the message says. This has caught three bad commits,
including one of our own where a failed `git add` left the message claiming
two files it never added.

**The tree is left clean between items.** Anything untracked is committed or
deleted before handing over. An agent cannot distinguish "clutter" from
"someone else's work in progress", and asking wastes a round trip.

**No `git am`, `git checkout`, `git pull` or rebase in a tree with a live
agent session.** Stop the session or use a worktree. This happened twice and
was survivable only by luck.

**A red baseline is not automatically a code problem.** If the Emacs oracles
fail with a subprocess error rather than an assertion failure, that is an
environment limitation. Report it, run the other three checks, say so in the
commit. Never add a skip, a try/catch or a relaxed timeout to make an oracle
pass — the oracle is what caught the repeater bug that byte checking missed.

**A check you have never seen fail is not yet a check.** Both the gate and the
pre-commit hook were verified by deliberately sabotaging the write path and
confirming a refusal at 48.5%.
