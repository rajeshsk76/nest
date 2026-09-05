#!/usr/bin/env node
/**
 * Scaffold: Nest vs Emacs --batch corpus (OUT OF SCOPE for byte-splice MVP).
 *
 * Needs:
 * - emacs on the runner (emacs-nox or full)
 * - workflow PAT / secrets if the corpus lives in a private repo
 * - a checked-in fixtures/emacs-corpus/ (or download step) — TBD size (~300 files)
 *
 * This script only documents the workflow and exits 0 when --dry-run.
 */
const dry = process.argv.includes("--dry-run");

console.log(`Emacs corpus conformance (scaffold)
=====================================
Status: NOT IMPLEMENTED — needs emacs on runner + corpus + optional workflow PAT.

Planned flow:
  1. Load each fixture from fixtures/emacs-corpus/
  2. Run Nest zero-edit + mark-done splice where applicable
  3. Run emacs --batch with org-mode to advance repeaters / normalize
  4. Diff Nest output vs Emacs output; publish score

Blocked on: emacs binary in CI, corpus checkout credentials (PAT), corpus path.
`);

if (dry) {
  console.log("dry-run: ok");
  process.exit(0);
}

console.error("Refuse: corpus runner not wired yet. Pass --dry-run to exit 0.");
process.exit(2);
