#!/usr/bin/env node
/**
 * Track A.4: Nest vs Emacs corpus runner.
 * Fail-closed if emacs missing. Invokes existing oracle scripts for
 * repeater Mark DONE and numeric table align (reference edit + semantic match).
 * Fixtures: fixtures/emacs-corpus/{repeater-mark-done,numeric-table}.org
 *
 * Exit 0 pass, 1 mismatch, 2 emacs missing.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const corpusDir = path.join(root, 'fixtures/emacs-corpus')

function hasEmacs() {
  return spawnSync('emacs', ['--version'], { encoding: 'utf8' }).status === 0
}

function emacsVersion() {
  const r = spawnSync('emacs', ['--version'], { encoding: 'utf8' })
  return ((r.stdout || '').split('\n')[0] || '').trim() || 'unknown'
}

function fail(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

function runOracle(scriptRel) {
  console.log('')
  console.log('→ ' + scriptRel)
  const r = spawnSync(process.execPath, [path.join(root, scriptRel)], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) {
    fail('FAIL: ' + scriptRel + ' exited ' + r.status, r.status === 2 ? 2 : 1)
  }
}

function runNestVite(runnerSource, label) {
  const tmp = path.join(os.tmpdir(), `nest-corpus-${label}-${process.pid}.mts`)
  fs.writeFileSync(tmp, runnerSource)
  const r = spawnSync('npx', ['vite-node', tmp], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  fs.rmSync(tmp, { force: true })
  if (r.status !== 0) fail('FAIL: Nest ' + label + ': ' + (r.stderr || r.stdout))
  return r.stdout
}
function semanticRepeater(src) {
  return {
    todo: (src.match(/^\* (\S+)/m) || [])[1] || null,
    scheduled: (src.match(/SCHEDULED:\s*(<[^>]+>)/) || [])[1] || null,
    deadline: (src.match(/DEADLINE:\s*(<[^>]+>)/) || [])[1] || null,
    last: (src.match(/:LAST_REPEAT:\s*(\[[^\]]+\])/) || [])[1] || null,
    beginSrc: /#\+BEGIN_SRC emacs-lisp/.test(src),
    macro: /#\+MACRO: greeting Hello \$1/.test(src),
  }
}

function extractTable(src) {
  const lines = src.split('\n')
  const out = []
  let inTable = false
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      inTable = true
      out.push(line.replace(/\s+$/, ''))
    } else if (inTable) break
  }
  return out.join('\n') + '\n'
}

function readBackRepeater() {
  const fixturePath = path.join(corpusDir, 'repeater-mark-done.org')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  const NOW = { year: 2026, month: 9, day: 6, hour: 12, minute: 17 }
  const nestOut = runNestVite(
    'import { markDoneInSource, listHeadlines } from "./src/lib/org.ts"\n' +
      'const src = ' + JSON.stringify(fixture) + '\n' +
      'const h = listHeadlines(src, "oracle")[0]\n' +
      'const now = new Date(Date.UTC(' + NOW.year + ', ' + (NOW.month - 1) + ', ' + NOW.day + ', ' + NOW.hour + ', ' + NOW.minute + '))\n' +
      'process.stdout.write(markDoneInSource(src, h.path, { now }))\n',
    'repeater',
  )
  const before = semanticRepeater(fixture)
  const after = semanticRepeater(nestOut)
  console.log('')
  console.log('→ read-back: repeater-mark-done.org')
  let failed = 0
  if (!after.beginSrc || !before.beginSrc) {
    console.log('FAIL  BEGIN_SRC must survive')
    failed++
  } else console.log('PASS  BEGIN_SRC preserved')
  if (!after.macro || !before.macro) {
    console.log('FAIL  MACRO must survive')
    failed++
  } else console.log('PASS  MACRO preserved')
  if (before.scheduled === after.scheduled) {
    console.log('FAIL  SCHEDULED should advance')
    failed++
  } else console.log('PASS  SCHEDULED changed: ' + before.scheduled + ' → ' + after.scheduled)
  if (!after.last) {
    console.log('FAIL  LAST_REPEAT should be set')
    failed++
  } else console.log('PASS  LAST_REPEAT set: ' + after.last)
  if (after.todo !== 'TODO') {
    console.log('FAIL  repeater should remain TODO after auto-repeat')
    failed++
  } else console.log('PASS  todo keyword TODO after auto-repeat')
  if (failed) fail('FAIL: repeater read-back ' + failed + ' check(s)')
  console.log('PASS  repeater read-back')
}
function readBackTable() {
  const fixturePath = path.join(corpusDir, 'numeric-table.org')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  const nestOut = runNestVite(
    'import { updateTableCellInSource } from "./src/lib/org.ts"\n' +
      'const src = ' + JSON.stringify(fixture) + '\n' +
      'process.stdout.write(updateTableCellInSource(src, 0, 2, 1, "99"))\n',
    'table',
  )
  const before = extractTable(fixture)
  const after = extractTable(nestOut)
  console.log('')
  console.log('→ read-back: numeric-table.org')
  let failed = 0
  if (!nestOut.includes('Keep this paragraph') || !nestOut.includes('* Other')) {
    console.log('FAIL  non-table regions must survive')
    failed++
  } else console.log('PASS  non-table regions preserved')
  if (before === after) {
    console.log('FAIL  table should change')
    failed++
  } else console.log('PASS  table bytes changed as intended')
  if (!after.includes('|  99 |') || !after.includes('|   1 |')) {
    console.log('FAIL  expected numeric right-align')
    failed++
  } else console.log('PASS  numeric right-align present')
  if (failed) fail('FAIL: table read-back ' + failed + ' check(s)')
  console.log('PASS  table read-back')
}

function main() {
  console.log('Emacs corpus conformance (Track A.4)')
  console.log('====================================')
  if (!hasEmacs()) {
    fail(
      'FAIL: emacs not found on PATH (install emacs-nox). Corpus runner is fail-closed — never skips green.',
      2,
    )
  }
  console.log('emacs: ' + emacsVersion())
  if (!fs.existsSync(corpusDir)) fail('FAIL: missing ' + corpusDir)
  for (const name of ['repeater-mark-done.org', 'numeric-table.org']) {
    const p = path.join(corpusDir, name)
    if (!fs.existsSync(p)) fail('FAIL: missing required fixture ' + p)
    console.log('fixture: ' + path.relative(root, p))
  }

  // Reference edit: Emacs org-todo / org-table-align vs Nest (existing oracles).
  runOracle('scripts/emacs-repeater-oracle.mjs')
  runOracle('scripts/emacs-table-oracle.mjs')

  // Read-back on pinned corpus fixtures (Nest output digests vs intended edit).
  readBackRepeater()
  readBackTable()

  console.log('')
  console.log('PASS: emacs corpus conformance (repeater + numeric table)')
}

main()
