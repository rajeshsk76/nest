# Nest — working rules

The product guarantee: bytes the user did not edit do not move.

1. No new write surface ships without its conformance check, in the same commit.
2. Never regenerate a file from the AST. Splice spans via applyEdits.
   stringifyOrg is display-only and must never appear in a write path.
3. Never weaken a check to make code pass. No it.skip, no lowering --gate,
   no helper defined inside scripts/ that shadows src/lib.
4. Emacs is the oracle. org-element.el is the only spec Org has.
5. Run `npm run test:all` and `npm run conformance:zero-edit` before every commit.
6. Never commit inbox.org or projects.org from the repo root — those are
   the user's real tasks.

## On red checks

"Any other red is yours" means a failure in code you did not write. A test
you just wrote failing is your bug — fix it and continue. Stop and report
only when something you did not touch is failing.

## On scope

Do not add dependencies. If a feature seems to need one, the shape is wrong:
extract the logic into a pure function in src/lib/ and test it in node.
vitest.config.ts is environment: 'node' deliberately.

A feature item changes what that feature needs and nothing else. Changing a
function's signature, adding state, or altering unrelated effects is scope
creep even when the code is correct. If the item seems to require it, stop
and explain instead.
