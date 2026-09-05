# Falsification: SCHEDULED repeater round-trip

**Date:** 2026-09-05
**Verdict (AST regenerate): FAIL**
**Verdict (byte-splice mark DONE): PASS on file integrity**

## Goal

Check whether Nest save path preserves a SCHEDULED repeater and whether Mark DONE matches Emacs repeater semantics.

## How Nest writes now (byte-splice MVP)

Today Mark DONE and outline TODO cycle splice only the keyword token.
If the span is unsure, the write is refused (no full-file stringify fallback).
Zero-edit identity is enforced by conformance:zero-edit (>=95% installer gate).
Other edit kinds may still stringify. Emacs repeater advance is deferred.

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

## After Mark DONE (byte-splice path)

```
* DONE Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
```

Only the TODO to DONE token bytes change. Blank line, BEGIN_SRC casing, macro line, and +1w are preserved.

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
| Emacs-correct DONE for repeaters | No | No (deferred) |

## Verdict

FAIL on Emacs repeater semantics (date advance / state reset) — deferred.

PASS on the tonight gate: Mark DONE no longer destroys the file via full uniorg-stringify; zero-edit identity holds; conformance script enforces >=95% byte-identical zero-edit on the fixture set.

Re-run via the test suite and conformance:zero-edit.

Do not claim full Emacs coexistence until repeater DONE matches Emacs and the public emacs-batch corpus score is published (conformance-emacs-corpus scaffold only).
