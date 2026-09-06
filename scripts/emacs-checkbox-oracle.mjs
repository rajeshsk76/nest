#!/usr/bin/env node
/**
 * Emacs oracle for checkbox toggling (the checkbox group).
 *
 * Toggles the deepest checkbox in a nested checklist via emacs --batch
 * org-toggle-checkbox, and via Nest's toggleCheckboxInSource, then compares
 * full-file bytes. Exit 0 match, 1 diverge, 2 emacs missing (unless
 * --skip-missing).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Scratch space for oracle temp files.
 *
 * These scripts used to write into the system temp directory. Sandboxed
 * agents (Codex and friends) permit the repo directory and deny that path,
 * so the writes failed with EPERM and the oracles reported a spurious exit 1
 * while Emacs itself ran fine. Keeping scratch inside the repo lets the
 * oracles run everywhere. .nest-tmp/ is gitignored.
 */
function scratchRoot() {
  const dir = path.join(root, '.nest-tmp')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const argv = process.argv.slice(2)
const skipMissing = argv.includes('--skip-missing')

function hasEmacs() {
  return spawnSync('emacs', ['--version'], { encoding: 'utf8' }).status === 0
}

const FIXTURE = `* Project [0/1]
- [ ] Parent [0/1]
  - [ ] Child [1/2]
    - [X] One
    - [ ] Two
`

function runEmacs(fixture) {
  const dir = fs.mkdtempSync(path.join(scratchRoot(), 'nest-checkbox-oracle-'))
  const inFile = path.join(dir, 'in.org')
  const outFile = path.join(dir, 'out.org')
  fs.writeFileSync(inFile, fixture)
  // Point at the deepest leaf ("Two") and toggle it, mirroring Nest's operation.
  const elisp =
    '(progn\n' +
    "  (require 'org)\n" +
    `  (find-file ${JSON.stringify(inFile)})\n` +
    '  (org-mode)\n' +
    '  (goto-char (point-min))\n' +
    '  (search-forward "Two")\n' +
    '  (org-toggle-checkbox)\n' +
    `  (write-region (point-min) (point-max) ${JSON.stringify(outFile)})\n` +
    '  (kill-emacs 0))'
  const r = spawnSync('emacs', ['--batch', '--eval', elisp], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  if (r.status !== 0) {
    console.error('emacs failed:', r.stderr || r.stdout)
    process.exit(1)
  }
  const out = fs.readFileSync(outFile, 'utf8')
  fs.rmSync(dir, { recursive: true, force: true })
  return out
}

function runNest(fixture) {
  const runner =
    'import { listCheckboxes, toggleCheckboxInSource } from "./src/lib/org-checkboxes.ts"\n' +
    `const src = ${JSON.stringify(fixture)}\n` +
    'const idx = listCheckboxes(src).findIndex((i) => i.text === "Two")\n' +
    'process.stdout.write(toggleCheckboxInSource(src, idx).next)\n'
  const tmp = path.join(scratchRoot(), `nest-checkbox-oracle-run-${process.pid}.mts`)
  fs.writeFileSync(tmp, runner)
  const r = spawnSync('npx', ['vite-node', tmp], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  fs.rmSync(tmp, { force: true })
  if (r.status !== 0) {
    console.error('Nest toggleCheckbox failed:', r.stderr || r.stdout)
    process.exit(1)
  }
  return r.stdout
}

function main() {
  if (!hasEmacs()) {
    if (skipMissing) {
      console.log('SKIP: emacs not found on PATH')
      process.exit(0)
    }
    console.error('FAIL: emacs not found (install emacs-nox or pass --skip-missing)')
    process.exit(2)
  }
  const emacsOut = runEmacs(FIXTURE)
  const nestOut = runNest(FIXTURE)

  console.log('Emacs checkbox toggle oracle (nested checklist, toggle "Two")')
  console.log('---------------------------------------------------------------')
  console.log('Emacs:')
  process.stdout.write(emacsOut)
  console.log('Nest:')
  process.stdout.write(nestOut)

  const ok = emacsOut === nestOut
  if (!ok) {
    console.log('FAIL  full-file bytes differ')
    const eLines = emacsOut.split('\n')
    const nLines = nestOut.split('\n')
    for (let i = 0; i < Math.max(eLines.length, nLines.length); i++) {
      if (eLines[i] !== nLines[i]) {
        console.log(`  line ${i + 1}:`)
        console.log(`    emacs: ${JSON.stringify(eLines[i])}`)
        console.log(`    nest:  ${JSON.stringify(nLines[i])}`)
      }
    }
    console.error('FAIL: Nest diverges from Emacs on checkbox toggle')
    process.exit(1)
  }
  console.log('PASS  full-file bytes match')
  console.log('PASS: Nest matches Emacs on nested checkbox toggle + cookie recompute')
}
main()
