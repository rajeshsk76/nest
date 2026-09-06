# Nest — the Org feature surface

A map of everything Org does, what Nest does today, and what it should and
should not attempt. Read alongside `docs/PLAN.md` (near-term tracks) and
`docs/COORDINATION.md` (who does what).

Status codes: **DONE** shipped and verified · **PART** partially there ·
**TODO** planned · **NO** deliberately out of scope.

Write-path column: **W** mutates a `.org` file and therefore needs a gate
check in the same commit · **R** read or display only, cannot break the badge.

---

## The selection rule

Every candidate feature gets one question, from the project's own roadmap rule:

> Does it make Capture or Today stickier, or protect the round-trip?

If neither, it is Emacs parity work — and Emacs already has it, for free, on
the machine of everyone who would want it. The only axis Nest wins on is being
usable by someone who will not run Emacs. Features that expose more Org syntax
serve the Emacs user; features that hide syntax serve the person Nest is for.

A second filter, from `docs/CONTEXT.md`: every W feature widens the surface the
guarantee has to cover. An R feature never can. When two features are worth
about the same, ship the R one.

---

## Tier 1 — Core editing

The minimum for Nest to be a usable Org editor. Mostly done.

| Feature | Status | W/R | Notes |
|---|---|---|---|
| Headline parse and outline | DONE | R | `listHeadlines` |
| TODO cycle | DONE | W | honours file-local `#+TODO:` |
| Custom keyword sets | DONE | R | `todoKeywordsFrom`, `todoStateLists` |
| Priority cookies | DONE | W | `updatePriorityInSource` |
| Tags | DONE | W | padding preserved, `org-tags-column` held |
| Declared tags `#+TAGS:` | DONE | R | B1 |
| Title editing | DONE | W | splices title span only |
| SCHEDULED / DEADLINE | DONE | W | date field spliced, repeaters preserved |
| Repeater semantics on DONE | DONE | W | `+1w`, `++1m`, `.+1d`, `:LAST_REPEAT:` — Emacs-verified |
| Promote / demote / move subtree | DONE | W | `org-structural.ts` |
| Insert heading | DONE | W | |
| Capture | DONE | W | `captureTodo` |
| Today agenda (single scope) | DONE | R | `collectTodayAgenda` |
| Inline markup display | DONE | R | `parseInlineMarkup`, `MarkupText` |
| `#+STARTUP:` | DONE | R | B2 |
| **Undo** | TODO | R | B6. Highest-value ease feature; restores a prior string |
| **Drawers collapsed by default** | TODO | R | B4 |
| **Raw markup toggle, off by default** | TODO | R | B3 |
| **Checkbox toggle `[ ]` / `[X]`** | TODO | W | Missing and conspicuous — lists are half the value of Org for non-coders |
| **Statistics cookies `[/]` `[%]`** | TODO | W | Must update on checkbox toggle or the file lies |
| **List item editing** | TODO | W | Add, remove, reorder. Indentation-sensitive, so splice carefully |
| **Archive to `::* Archived`** | TODO | W | Respects `#+ARCHIVE:`; the natural companion to DONE |
| **Refile within a file** | TODO | W | Cross-file refile is Tier 3 |

Checkboxes are the largest gap. A grocery list or packing list is exactly what a
non-coder wants, and Nest cannot tick a box.

---

## Tier 2 — High value, worth building

| Feature | Status | W/R | Notes |
|---|---|---|---|
| Tables: cell edit, add row | DONE | W | numeric right-align matches `org-table-align` |
| Src blocks: body edit | DONE | W | switches and `:tangle` preserved |
| HTML export | PART | R | C1. One file, inlined CSS |
| **Multi-file agenda** | TODO | R | Across the workspace folder. Most-requested thing a Today view lacks |
| **Search across files** | TODO | R | Substring plus structure (tag, state, date range). Not embeddings — see RAG note in PLAN |
| **Tag and property filtering** | TODO | R | `+work-urgent`, `PROP="value"`. The query language, not the agenda UI |
| **Clocking** | TODO | W | `CLOCK:` lines in `:LOGBOOK:`, clock in/out. Careful: two-line drawer edits |
| **Effort estimates** | TODO | W | `:Effort:` property. Cheap once properties are editable |
| **Property editing** | TODO | W | Read exists via drawers; editing does not |
| **Footnotes** | TODO | R | Display and navigate. Editing is Tier 3 |
| **Image display** | TODO | R | Inline `[[file:x.png]]` preview. Big perceived-quality win, zero write risk |
| **`nest.toml` workspace config** | TODO | R | Theme, hotkeys, capture templates, custom link prefixes |
| **Capture templates** | TODO | W | Declarative in `nest.toml`, never elisp |
| **Sorting a subtree** | TODO | W | By TODO, priority, deadline, alpha |
| **MCP read-only server** | PART | R | `nest-mcp.mjs` exists for verification; user-facing tools are C2 |

---

## Tier 3 — Later, or only if use demands it

| Feature | Status | W/R | Notes |
|---|---|---|---|
| Cross-file refile | TODO | W | Two files mutated at once; the guard is per-file today |
| `org-id` / `:CUSTOM_ID:` links | TODO | W | **Never write IDs into user files** unprompted — that is the org-roam mistake |
| Column view | NO | R | Emacs-shaped UI; a table view serves the same need better |
| Sparse trees | TODO | R | Effectively search plus fold state |
| Dynamic blocks (`#+BEGIN:` clocktable) | TODO | W | Regenerating content Nest did not author — high fidelity risk |
| Footnote editing | TODO | W | Renumbering touches the whole file. Contradicts one-region |
| Markdown export | TODO | R | Cheap once HTML export exists |
| ASCII / plain-text export | TODO | R | Cheap |
| Attachments (`org-attach`) | TODO | W | Directory conventions plus properties |
| Diary sexp timestamps | NO | R | Elisp evaluation by definition |
| `#+INCLUDE:` resolution | NO | R | Multi-file resolution at display time; wrong shape for a file editor |
| `#+SETUPFILE:` | NO | R | Same |
| Encryption (`org-crypt`) | NO | W | GPG plus in-place rewriting. Do not go near it |

---

## Tier 4 — Deliberately never

Not "not yet". These are decisions, and the reasons matter.

**Org-babel execution.** Running user code from a note-taking app is a security
surface with no bottom, and sessions, `:results`, `:var` and noweb make it a
language runtime. Nest displays src blocks and preserves their headers exactly.
It does not execute them.

**Tangling.** Adjacent to babel and writes files outside the org file. If it is
ever wanted, it belongs in a separate CLI, not in the editor.

**LaTeX, PDF, ODT, Beamer, Reveal export.** `ox-latex` alone is thousands of
lines and parity is unwinnable. HTML export exists to answer one question — how
does a non-Org person read this file — and one format answers it.

**Publishing projects (`org-publish`).** A static site generator wearing an
editor's clothes.

**An embedded Lisp interpreter.** Homoiconic config is genuinely appealing and
it is a plugin runtime: sandboxing, a frozen API, and user code that can reach
the filesystem. The moment user code can write, the gate no longer covers the
write path and the guarantee stops being provable. If scripting ever happens the
constraint is fixed: *config returns data, Nest performs the write.*

**Sync.** Contradicts the pitch, and it is the hardest problem in software.
The desktop writes; the phone reads exported HTML.

**A plugin marketplace.** Same reasoning, plus a permanent compatibility
obligation this project cannot carry.

---

## Ordering

Not a schedule. Each group finishes before the next starts, and each W item
ships with its gate check in the same commit.

**Now — finish Track B.** B3, B4, B6. All R. Nothing can break.

**Next — the checkbox group.** Toggle, statistics cookies, list item editing.
All W, all needing gate checks. This is the largest genuine gap in Tier 1 and
the most-used Org feature Nest cannot do. Emacs is the oracle for cookie
recalculation, which has non-obvious rules for nested lists.

**Then — archive and sort.** Both W, both natural companions to DONE, both
contained.

**Then — reading breadth.** Multi-file agenda, search, tag and property
filtering, image display. All R. This is where a Today view becomes an actual
system rather than a single-file toy, and none of it risks the badge.

**Then — reassess.** By that point there will be enough real use to know
whether the non-coder surface works. That should decide clocking versus
properties versus `nest.toml`, rather than this document deciding in advance.

---

## What is deliberately still missing

Worth stating plainly, because their absence looks like an oversight and is not:

- **No database, no index, no cache.** Search reads files. If that becomes too
  slow, a cache lives outside the org folder and is rebuildable in seconds.
- **No IDs written into user files.** Links key on path plus heading text.
- **No background process.** Nest runs when opened.
- **No account, no telemetry, no network calls.** Nothing to trust.

Each of these is a feature. They are the reason the guarantee is provable, and
they are the difference between Nest and every tool it is compared to.
