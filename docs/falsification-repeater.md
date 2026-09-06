# Falsification: SCHEDULED repeater round-trip

**Date:** 2026-09-06
**Verdict (AST regenerate): FAIL**
**Verdict (byte-splice mark DONE): PASS on file integrity**
**Verdict (Emacs repeater semantics): PASS**

## Goal

Check whether Nest save path preserves a SCHEDULED repeater and whether Mark DONE matches Emacs repeater semantics.

## How Nest writes now (byte-splice MVP)

Today Mark DONE and outline TODO cycle splice only the keyword token.
If the span is unsure, the write is refused (no full-file stringify fallback).
Zero-edit identity is enforced by conformance:zero-edit (>=95% installer gate).
Repeater Mark DONE advances stamps, resets to first TODO state, writes property stamp (byte-splice). Non-repeater stays TODO->DONE only.

## Fixture (before)

```
* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
```

## After zero-edit

Byte-identical to input.

## After Mark DONE (byte-splice path, repeater)

With frozen now 2026-09-06 Sun 12:17:

```
* TODO Water plants
SCHEDULED: <2026-09-12 Sat +1w>
:PROPERTIES:
:LAST_REPEAT: [2026-09-06 Sun 12:17]
:END:

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
```

Keyword resets to TODO; SCHEDULED advances by +1w; property stamp written.
Fragile tokens preserved. Oracle wired in package scripts.

## After AST parse then stringify (still broken; not used for mark-done)

```
* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>
#+begin_src emacs-lisp
(message "fragile")
#+end_src
#+MACRO: greeting Hello $1
```

## Findings

| Check | AST regenerate (old) | Byte-splice mark DONE (new) |
|-------|----------------------|-----------------------------|
| +1w survives Mark DONE | Yes (rawValue) | Yes (untouched bytes) |
| Blank lines / BEGIN_SRC case preserved | No | Yes |
| Byte-identical zero-edit save | No | Yes |
| Emacs-correct DONE for repeaters | No | Yes (+ / .+ / ++) |

## Verdict

PASS on Emacs repeater Mark DONE semantics (date advance / state reset, property stamp) — shipped.

PASS on the tonight gate: Mark DONE no longer destroys the file via full uniorg-stringify; zero-edit identity holds; conformance script enforces >=95% byte-identical zero-edit on the fixture set.

Re-run via the test suite and conformance:zero-edit.

Repeater DONE matches Emacs (test:emacs-oracle). Table numeric align matches Emacs (test:emacs-table-oracle). Track A.4 corpus runner (conformance:emacs-corpus) pins those fixtures under fixtures/emacs-corpus/ and fails closed without emacs.
