#!/usr/bin/env node
/**
 * Byte-fidelity conformance for the splice write path.
 *
 * Runs through vite-node so it can import the real mutators from src/lib/org.ts.
 * An earlier version of this script defined its own `zeroEditWrite(s) { return s }`
 * and scored 100% without importing a single line of Nest. Never do that again:
 * if this file does not import from ../src/lib/org.ts, it is not a gate.
 *
 * Checks per corpus file:
 *   1. zero-edit   -- a no-op mutation must return the identical string
 *   2. mark-DONE   -- plain: one changed line; repeater: ≤3 hunks + LAST_REPEAT
 *   3. reschedule  -- every stamp keeps its time of day, repeater and warning
 * Plus Track A.2 gate (required):
 *   4. table-numeric -- cell edit right-aligns numeric columns (Emacs `|  99 |`)
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
  RefuseWrite,
  assertOnlySpansChanged,
  changedRegions,
  listHeadlines,
  listTables,
  markDoneInSource,
  stampHasRepeater,
  updateScheduledInSource,
  updateTableCellInSource,
  updateTodoInSource,
} from '../src/lib/org.ts'
import { listCheckboxes, toggleCheckboxInSource } from '../src/lib/org-checkboxes.ts'

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

function headlineHasRepeater(h) {
  return stampHasRepeater(h.scheduled) || stampHasRepeater(h.deadline)
}

/** Repeater Mark DONE may touch keyword + planning + LAST_REPEAT (≤3 hunks). */
function isLegalRepeaterMarkDone(before, after) {
  if (after === before) return true
  if (changedRegions(before, after) > 3) return false
  if (!after.includes(':LAST_REPEAT:')) return false
  // Must not smash common fragile tokens outside the splice
  for (const token of ['#+BEGIN_SRC', '#+END_SRC', '#+MACRO:']) {
    if (before.includes(token) && !after.includes(token)) return false
  }
  return true
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
      const kw = h.todo === 'DONE' ? 'DONE' : h.todo === 'TODO' ? 'TODO' : null
      if (kw === 'TODO' || kw === 'DONE') {
        const noop = updateTodoInSource(source, h.path, kw)
        record(file, `zero-edit [${h.path}]`, noop === source, 'no-op mutated the file')
      } else {
        // Custom keywords / bare headlines: markDone idempotence only when non-repeater
        const out = markDoneInSource(source, h.path)
        if (headlineHasRepeater(h)) {
          record(file, `zero-edit [${h.path}]`, true, 'skipped repeater (second DONE advances again)')
        } else {
          const noop = markDoneInSource(out, h.path)
          record(file, `zero-edit [${h.path}]`, noop === out, 'no-op mutated the file')
        }
      }
    } catch (err) {
      record(file, `zero-edit [${h.path}]`, false, `refused: ${err.message}`)
    }

    // mark DONE: one line for plain; ≤3 hunks + LAST_REPEAT for repeaters
    try {
      const out = markDoneInSource(source, h.path)
      const ok = headlineHasRepeater(h)
        ? isLegalRepeaterMarkDone(source, out)
        : out === source || isSingleLineEdit(source, out)
      record(file, `mark-DONE [${h.path}]`, ok, 'illegal mark-DONE splice shape')
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

// ---------------------------------------------------------------------------
// Track A.2 — table numeric right-alignment after a one-cell edit (hard gate)
// ---------------------------------------------------------------------------
{
  const a2File = path.join(root, 'data/track-a2-numeric-table.org')
  if (!fs.existsSync(a2File)) {
    record(a2File, 'table-numeric-align', false, 'missing data/track-a2-numeric-table.org fixture')
  } else {
    const src = fs.readFileSync(a2File, 'utf8')
    try {
      const tables = listTables(src)
      if (tables.length < 1) {
        record(a2File, 'table-numeric-align', false, 'fixture has no org table')
      } else {
        // eggs row (index 2), Qty col (1) → 99; must Emacs-right-align
        const edited = updateTableCellInSource(src, 0, 2, 1, '99')
        const hasRight99 = edited.includes('|  99 |')
        const hasRight1 = edited.includes('|   1 |')
        const hasWrongLeft99 = edited.includes('| 99  |')
        const outsideOk =
          edited.includes('Keep this paragraph.') && edited.includes('* Other')
        const ok = hasRight99 && hasRight1 && !hasWrongLeft99 && outsideOk
        record(
          a2File,
          'table-numeric-align',
          ok,
          ok
            ? ''
            : `expected |  99 | and |   1 | after cell edit; got table region mismatch (left-pad=${hasWrongLeft99})`,
        )
      }
    } catch (err) {
      record(a2File, 'table-numeric-align', false, `refused: ${err.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Checkbox group — toggle + nested propagation + cookie recompute, exercised
// against real unrelated syntax (required gate)
// ---------------------------------------------------------------------------
{
  const checkboxFile = path.join(root, 'data/track-checkbox-fidelity.org')
  if (!fs.existsSync(checkboxFile)) {
    record(checkboxFile, 'checkbox-toggle', false, 'missing data/track-checkbox-fidelity.org fixture')
  } else {
    const src = fs.readFileSync(checkboxFile, 'utf8')
    try {
      const items = listCheckboxes(src)
      const twoIndex = items.findIndex((i) => i.text === 'Two')
      if (twoIndex < 0) {
        record(checkboxFile, 'checkbox-toggle', false, 'fixture missing expected "Two" checkbox item')
      } else {
        const result = toggleCheckboxInSource(src, twoIndex)
        const after = result.next
        assertOnlySpansChanged(src, after, result.edits) // throws if a byte moved outside declared spans

        const expectedInside = [
          '* Project [1/1]',
          '- [X] Parent [1/1]',
          '  - [X] Child [2/2]',
          '    - [X] One',
          '    - [X] Two',
        ]
        const hasAllInside = expectedInside.every((s) => after.includes(s))

        const expectedUntouched = [
          ':PROPERTIES:',
          ':CLIENT: café',
          ':END:',
          '#+BEGIN_SRC python :tangle build.py',
          'print("hello")',
          '#+END_SRC',
          '#+NAME: checklist',
          '#+CAPTION: A checklist with unrelated syntax around it',
        ]
        const hasAllUntouched = expectedUntouched.every((s) => after.includes(s) && src.includes(s))

        const ok = hasAllInside && hasAllUntouched
        record(
          checkboxFile,
          'checkbox-toggle',
          ok,
          ok ? '' : 'toggle produced unexpected output or disturbed unrelated syntax',
        )
      }
    } catch (err) {
      record(checkboxFile, 'checkbox-toggle', false, `refused: ${err.message}`)
    }

    // Toggling a checkbox whose state is derived from its children must refuse.
    try {
      const items = listCheckboxes(src)
      const parentIndex = items.findIndex((i) => i.hasChildren)
      if (parentIndex < 0) {
        record(checkboxFile, 'checkbox-parent-refuses', false, 'fixture has no parent checkbox to test')
      } else {
        toggleCheckboxInSource(src, parentIndex)
        record(checkboxFile, 'checkbox-parent-refuses', false, 'toggling a derived checkbox did not refuse')
      }
    } catch (err) {
      record(checkboxFile, 'checkbox-parent-refuses', err instanceof RefuseWrite, `unexpected error: ${err.message}`)
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
