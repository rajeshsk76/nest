#!/usr/bin/env node
/**
 * Byte-fidelity conformance for the splice write path.
 *
 * Runs through vite-node so it can import the real mutators from src/lib/org.ts.
 * An earlier version of this script defined its own `zeroEditWrite(s) { return s }`
 * and scored 100% without importing a single line of Nest. Never do that again:
 * if this file does not import from ../src/lib/org.ts, it is not a gate.
 *
 * Three checks per corpus file:
 *   1. zero-edit   -- a no-op mutation must return the identical string
 *   2. mark-DONE   -- every headline, exactly one changed line, same line count
 *   3. reschedule  -- every stamp keeps its time of day, repeater and warning
 *
 * Usage:
 *   npm run conformance:zero-edit
 *   npm run conformance:zero-edit -- --dir path/to/corpus --gate 95
 * Exit 0 when the pass rate meets the gate, else 1.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  changedRegions,
  listHeadlines,
  markDoneInSource,
  updateScheduledInSource,
} from '../src/lib/org.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const argOf = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : null
}
const GATE = Number(argOf('--gate') ?? 95)
const dirs = argOf('--dir')
  ? [path.resolve(root, argOf('--dir'))]
  : [path.join(root, 'fixtures/corpus'), path.join(root, 'src/fixtures'), path.join(root, 'data')]

function collectOrgFiles() {
  const seen = new Set()
  const files = []
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.org')) continue
      const full = path.join(dir, name)
      const body = fs.readFileSync(full, 'utf8')
      if (seen.has(body)) continue // data/ and src/fixtures/ hold the same seeds
      seen.add(body)
      files.push(full)
    }
  }
  return files
}

/** One changed line, no lines added or removed, one contiguous region. */
function isSingleLineEdit(before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length !== b.length) return false
  if (changedRegions(before, after) > 1) return false
  return a.filter((line, i) => line !== b[i]).length === 1
}

/** Every timestamp's suffix: time of day, repeater, warning period. */
function stampSuffixes(source) {
  return [...source.matchAll(/[<[]\d{4}-\d{2}-\d{2}(?:[ \t]+\S{2,3})?([^\]>]*)[>\]]/g)]
    .map((m) => m[1].trim())
    .filter(Boolean)
}

const checks = []
const record = (file, name, ok, detail = '') =>
  checks.push({ file: path.relative(root, file), name, ok, detail })

for (const file of collectOrgFiles()) {
  const source = fs.readFileSync(file, 'utf8')
  const heads = listHeadlines(source)

  for (const h of heads) {
    // no-op: setting the keyword it already has must not move a byte
    try {
      const out = markDoneInSource(source, h.path)
      const noop = markDoneInSource(out, h.path)
      record(file, `zero-edit [${h.path}]`, noop === out, 'no-op mutated the file')
    } catch (err) {
      record(file, `zero-edit [${h.path}]`, false, `refused: ${err.message}`)
    }

    // mark DONE: exactly one line may change
    try {
      const out = markDoneInSource(source, h.path)
      const ok = out === source || isSingleLineEdit(source, out)
      record(file, `mark-DONE [${h.path}]`, ok, 'touched more than one line')
    } catch (err) {
      record(file, `mark-DONE [${h.path}]`, false, `refused: ${err.message}`)
    }

    // reschedule: repeaters, warnings and times of day must survive
    try {
      const out = updateScheduledInSource(source, h.path, { year: 2027, month: 3, day: 1 })
      if (out !== source) {
        const after = stampSuffixes(out)
        const kept = stampSuffixes(source).every((s) => after.includes(s))
        record(file, `reschedule [${h.path}]`, kept, 'lost a repeater, warning or time of day')
      }
    } catch (err) {
      record(file, `reschedule [${h.path}]`, false, `refused: ${err.message}`)
    }
  }
}

if (checks.length === 0) {
  console.error('No .org corpus files found. Looked in:\n  ' + dirs.join('\n  '))
  process.exit(1)
}

const passed = checks.filter((c) => c.ok).length
const pct = (passed / checks.length) * 100

console.log('Splice byte-fidelity conformance')
console.log('--------------------------------')
for (const file of [...new Set(checks.map((c) => c.file))]) {
  const rows = checks.filter((c) => c.file === file)
  const ok = rows.filter((r) => r.ok).length
  console.log(`${ok === rows.length ? 'PASS' : 'FAIL'}  ${file}  ${ok}/${rows.length} checks`)
  for (const r of rows.filter((r) => !r.ok)) console.log(`        ${r.name}: ${r.detail}`)
}
console.log('--------------------------------')
console.log(`Result: ${passed}/${checks.length} checks passed (${pct.toFixed(1)}%)`)
console.log(`Installer gate: >=${GATE}% required before shipping.`)

if (pct < GATE) {
  console.error(`FAIL: ${pct.toFixed(1)}% < ${GATE}% gate`)
  process.exit(1)
}
console.log(`PASS: meets >=${GATE}% gate`)
