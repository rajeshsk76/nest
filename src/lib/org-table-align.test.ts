import { describe, expect, it } from 'vitest'
import {
  changedRegions,
  listTables,
  serializeOrgTable,
  updateTableCellInSource,
} from './org'

describe('Track A.2 numeric table alignment', () => {
  const SAMPLE = `#+TITLE: Tables

* Groceries
| Item | Qty |
|------+-----|
| eggs | 12  |
| milk | 1   |

Keep this paragraph.

* Other
Unrelated body.
`

  it('serializes with Emacs-friendly column alignment', () => {
    const out = serializeOrgTable(
      [
        { kind: 'standard', cells: ['Item', 'Qty'] },
        { kind: 'rule', cells: [] },
        { kind: 'standard', cells: ['eggs', '12'] },
        { kind: 'standard', cells: ['milk', '1'] },
      ],
      '',
    )
    // Text col left (padEnd); numeric Qty right (padStart) — Emacs `|  12 |`
    expect(out).toBe(
      `| Item | Qty |
|------+-----|
| eggs |  12 |
| milk |   1 |
`,
    )
  })

  it('right-aligns numeric columns and left-aligns text columns', () => {
    const out = serializeOrgTable(
      [
        { kind: 'standard', cells: ['Name', 'Score', 'Note'] },
        { kind: 'rule', cells: [] },
        { kind: 'standard', cells: ['alice', '99', 'ok'] },
        { kind: 'standard', cells: ['bob', '7', ''] },
      ],
      '',
    )
    expect(out).toContain('| alice |    99 | ok   |')
    expect(out).toContain('| bob   |     7 |      |')
    expect(out).not.toContain('| 99  |')
    expect(out).toMatch(/\|\s+99\s\|/)
  })

  it('updates one cell without touching outside bytes or reordering headlines', () => {
    const before = SAMPLE
    const next = updateTableCellInSource(before, 0, 2, 1, '24')
    expect(next).toContain('| eggs |  24 |')
    expect(next).toContain('| milk |   1 |')
    expect(next).not.toContain('| 24  |')
    expect(next).toContain('Keep this paragraph.')
    expect(next).toContain('* Other')
    expect(next).toContain('Unrelated body.')
    const table = listTables(before)[0]!
    expect(next.slice(0, table.start)).toBe(before.slice(0, table.start))
    expect(next.indexOf('* Other')).toBeGreaterThan(next.indexOf('| milk'))
    expect(next.indexOf('* Groceries')).toBeLessThan(next.indexOf('* Other'))
    expect(changedRegions(before, next)).toBe(1)
  })
})
