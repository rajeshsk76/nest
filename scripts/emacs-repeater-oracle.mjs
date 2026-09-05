#!/usr/bin/env node
/**
 * Emacs oracle for repeater Mark DONE.
 *
 * Runs Org org-todo / org-auto-repeat-maybe in emacs --batch, then compares
 * Nest markDoneInSource on semantic fields (todo, SCHEDULED, LAST_REPEAT,
 * fragile tokens). Exit 0 match, 1 diverge, 2 emacs missing (unless --skip-missing).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const skipMissing = argv.includes('--skip-missing')
const loose = argv.includes('--loose')

function hasEmacs() {
  return spawnSync('emacs', ['--version'], { encoding: 'utf8' }).status === 0
}

const FIXTURE = `* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
`

const NOW = { year: 2026, month: 9, day: 6, hour: 12, minute: 17 }

function runEmacs(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-oracle-'))
  const inFile = path.join(dir, 'in.org')
  const outFile = path.join(dir, 'out.org')
  fs.writeFileSync(inFile, fixture)
  const elisp =
    '(progn\n' +
    "  (require 'org)\n" +
    "  (setq org-log-repeat 'time)\n" +
    '  (setq org-log-done nil)\n' +
    '  (defun nest-fixed-now ()\n' +
    `    (encode-time 0 ${NOW.minute} ${NOW.hour} ${NOW.day} ${NOW.month} ${NOW.year} t))\n` +
    "  (advice-add 'current-time :override #'nest-fixed-now)\n" +
    "  (advice-add 'org-current-effective-time :override #'nest-fixed-now)\n" +
    "  (advice-add 'org-today :override (lambda () (time-to-days (current-time))))\n" +
    `  (find-file ${JSON.stringify(inFile)})\n` +
    '  (org-mode)\n' +
    '  (goto-char (point-min))\n' +
    "  (org-todo 'done)\n" +
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
    'import { markDoneInSource, listHeadlines } from "./src/lib/org.ts"\n' +
    `const src = ${JSON.stringify(fixture)}\n` +
    'const h = listHeadlines(src, "oracle")[0]\n' +
    `const now = new Date(Date.UTC(${NOW.year}, ${NOW.month - 1}, ${NOW.day}, ${NOW.hour}, ${NOW.minute}))\n` +
    'process.stdout.write(markDoneInSource(src, h.path, { now }))\n'
  const tmp = path.join(os.tmpdir(), `nest-oracle-run-${process.pid}.mts`)
  fs.writeFileSync(tmp, runner)
  const r = spawnSync('npx', ['vite-node', tmp], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  fs.rmSync(tmp, { force: true })
  if (r.status !== 0) {
    console.error('Nest markDone failed:', r.stderr || r.stdout)
    process.exit(1)
  }
  return r.stdout
}

function semantic(src) {
  return {
    todo: (src.match(/^\* (\S+)/m) || [])[1] || null,
    scheduled: (src.match(/SCHEDULED:\s*(<[^>]+>)/) || [])[1] || null,
    deadline: (src.match(/DEADLINE:\s*(<[^>]+>)/) || [])[1] || null,
    last: (src.match(/:LAST_REPEAT:\s*(\[[^\]]+\])/) || [])[1] || null,
    beginSrc: /#\+BEGIN_SRC emacs-lisp/.test(src),
    macro: /#\+MACRO: greeting Hello \$1/.test(src),
  }
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
  const e = semantic(emacsOut)
  const n = semantic(nestOut)
  const checks = [
    ['todo keyword', e.todo, n.todo],
    ['SCHEDULED', e.scheduled, n.scheduled],
    ['DEADLINE', e.deadline, n.deadline],
    ['LAST_REPEAT date+time', e.last, n.last],
    ['BEGIN_SRC case', e.beginSrc, n.beginSrc],
    ['MACRO preserved', e.macro, n.macro],
  ]
  let failed = 0
  console.log('Emacs repeater oracle (+1w fixture)')
  console.log('-----------------------------------')
  for (const [name, ev, nv] of checks) {
    const ok = Object.is(ev, nv)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: emacs=${JSON.stringify(ev)} nest=${JSON.stringify(nv)}`)
    if (!ok) failed += 1
  }
  if (!loose && emacsOut !== nestOut) {
    console.log('NOTE  full-file bytes differ (semantics above are the gate)')
    const eLines = emacsOut.split('\n')
    const nLines = nestOut.split('\n')
    for (let i = 0; i < Math.max(eLines.length, nLines.length); i++) {
      if (eLines[i] !== nLines[i]) {
        console.log(`  line ${i + 1}:`)
        console.log(`    emacs: ${JSON.stringify(eLines[i])}`)
        console.log(`    nest:  ${JSON.stringify(nLines[i])}`)
      }
    }
  }
  if (failed > 0) {
    console.error(`FAIL: ${failed} semantic field(s) diverged`)
    process.exit(1)
  }
  console.log('PASS: Nest matches Emacs on repeater Mark DONE semantics')
}
main()
