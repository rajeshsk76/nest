#!/usr/bin/env node
/**
 * Emacs oracle for Org table numeric right-alignment (Track A.2).
 *
 * Edits one Qty cell, runs org-table-align in emacs --batch, and compares
 * Nest updateTableCellInSource bytes for the table region. Exit 0 match,
 * 1 diverge, 2 emacs missing (unless --skip-missing).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const skipMissing = argv.includes('--skip-missing')

function hasEmacs() {
  return spawnSync('emacs', ['--version'], { encoding: 'utf8' }).status === 0
}

const FIXTURE_PATH = path.join(root, 'data/track-a2-numeric-table.org')
const EDIT_ROW = 2 // eggs data row (0=header, 1=hline, 2=eggs)
const EDIT_COL = 1 // Qty
const EDIT_VALUE = '99'

function extractTable(src) {
  const lines = src.split('\n')
  const out = []
  let inTable = false
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      inTable = true
      out.push(line.replace(/\s+$/, ''))
    } else if (inTable) {
      break
    }
  }
  return out.join('\n') + '\n'
}

function runEmacs(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-table-oracle-'))
  const inFile = path.join(dir, 'in.org')
  const outFile = path.join(dir, 'out.org')
  fs.writeFileSync(inFile, fixture)
  // Move to eggs/Qty, replace field with 99, align (mirrors Nest cell edit).
  const elisp =
    '(progn\n' +
    "  (require 'org)\n" +
    `  (find-file ${JSON.stringify(inFile)})\n` +
    '  (org-mode)\n' +
    '  (goto-char (point-min))\n' +
    '  (re-search-forward "^| eggs")\n' +
    '  (org-table-goto-column 2)\n' +
    '  (org-table-blank-field)\n' +
    `  (insert ${JSON.stringify(EDIT_VALUE)})\n` +
    '  (org-table-align)\n' +
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
    'import { updateTableCellInSource } from "./src/lib/org.ts"\n' +
    `const src = ${JSON.stringify(fixture)}\n` +
    `process.stdout.write(updateTableCellInSource(src, 0, ${EDIT_ROW}, ${EDIT_COL}, ${JSON.stringify(EDIT_VALUE)}))\n`
  const tmp = path.join(os.tmpdir(), `nest-table-oracle-run-${process.pid}.mts`)
  fs.writeFileSync(tmp, runner)
  const r = spawnSync('npx', ['vite-node', tmp], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  fs.rmSync(tmp, { force: true })
  if (r.status !== 0) {
    console.error('Nest updateTableCell failed:', r.stderr || r.stdout)
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
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error('FAIL: missing fixture', FIXTURE_PATH)
    process.exit(1)
  }
  const fixture = fs.readFileSync(FIXTURE_PATH, 'utf8')
  const emacsOut = runEmacs(fixture)
  const nestOut = runNest(fixture)
  const eTable = extractTable(emacsOut)
  const nTable = extractTable(nestOut)

  console.log('Emacs table numeric-align oracle (Qty → 99)')
  console.log('------------------------------------------')
  console.log('Emacs table:')
  process.stdout.write(eTable)
  console.log('Nest table:')
  process.stdout.write(nTable)

  const checks = [
    ['table bytes', eTable, nTable],
    ['right-aligned 99', eTable.includes('|  99 |'), nTable.includes('|  99 |')],
    ['right-aligned 1', eTable.includes('|   1 |'), nTable.includes('|   1 |')],
    ['no left-padded 99', !eTable.includes('| 99  |'), !nTable.includes('| 99  |')],
  ]
  let failed = 0
  for (const [name, ev, nv] of checks) {
    const ok = Object.is(ev, nv) || (typeof ev === 'boolean' && ev === true && nv === true)
    // For boolean checks, require both true; for table bytes, require equality
    const pass =
      name === 'table bytes'
        ? ev === nv
        : ev === true && nv === true
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) {
      failed += 1
      if (name === 'table bytes') {
        console.log('  emacs:', JSON.stringify(ev))
        console.log('  nest: ', JSON.stringify(nv))
      }
    }
  }
  if (failed > 0) {
    console.error(`FAIL: ${failed} check(s) diverged`)
    process.exit(1)
  }
  console.log('PASS: Nest matches Emacs on numeric table cell edit alignment')
}
main()
