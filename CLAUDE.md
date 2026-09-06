# Nest — working rules

The product guarantee: bytes the user did not edit do not move.

1. No new write surface ships without its conformance check, in the same commit.
2. Never regenerate a file from the AST. Splice spans via applyEdits.
   stringifyOrg is display-only and must never appear in a write path.
3. Never weaken a check to make code pass. No it.skip, no lowering --gate,
   no helper defined inside scripts/ that shadows src/lib.
4. Emacs is the oracle. org-element.el is the only spec Org has.
5. Run `npm run conformance:zero-edit` and `npx vitest run` before every commit.
6. Never commit inbox.org or projects.org from the repo root — those are
   the user's real tasks.
