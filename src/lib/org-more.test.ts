import { describe, expect, it } from 'vitest'
import {
  demoteSubtreeInSource,
  insertHeadingInSource,
  listHeadlines,
  moveSubtreeInSource,
  promoteSubtreeInSource,
  RefuseWrite,
  changedRegions,
  zeroEditWrite,
  parseInlineMarkup,
  updateTitleInSource,
  listTables,
  serializeOrgTable,
  updateTableCellInSource,
  addTableRowInSource,
  listSrcBlocks,
  updateSrcBodyInSource,
  normalizeSrcBody,
} from './org'

const SAMPLE = `#+TITLE: Test

* TODO Write tests
SCHEDULED: <2026-09-05 Sat>
Body text.

* DONE Already done
* Parent
** TODO Nested task
DEADLINE: <2026-09-05 Sat>
`

const TAGGED = `#+TITLE: Tags

* TODO [#A] High priority work :work:urgent:
SCHEDULED: <2026-09-05 Sat>

* TODO [#B] Medium chore :home:
* TODO [#C] Low backlog :nest:
* TODO Untagged open task
`

describe('zero-edit installer gate', () => {
  it('fixture samples are >=95% byte-identical on zero-edit', () => {
    const fixtures = [
      SAMPLE,
      TAGGED,
      `* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC
`,
    ]
    const identical = fixtures.filter((s) => zeroEditWrite(s) === s).length
    const pct = (identical / fixtures.length) * 100
    expect(pct).toBeGreaterThanOrEqual(95)
  })
})


describe('inline markup', () => {
  const MARKUP = `#+TITLE: Markup

* TODO Try *bold* /italic/ _under_ +strike+ =verb= ~code~ and [[https://orgmode.org][Org mode]] :nest:markup:
Body stays plain.
`

  it('parses emphasis and links for display helpers', () => {
    const title =
      'Try *bold* /italic/ _under_ +strike+ =verb= ~code~ and [[https://orgmode.org][Org mode]]'
    const nodes = parseInlineMarkup(title)
    const kinds = nodes.map((n) => n.kind)
    expect(kinds).toContain('bold')
    expect(kinds).toContain('italic')
    expect(kinds).toContain('underline')
    expect(kinds).toContain('strike')
    expect(kinds).toContain('verbatim')
    expect(kinds).toContain('code')
    expect(kinds).toContain('link')
    const link = nodes.find((n) => n.kind === 'link')
    expect(link).toEqual({
      kind: 'link',
      url: 'https://orgmode.org',
      label: 'Org mode',
    })
    const bare = parseInlineMarkup('See [[https://example.com]]')
    const bareLink = bare.find((n) => n.kind === 'link')
    expect(bareLink).toEqual({
      kind: 'link',
      url: 'https://example.com',
      label: 'https://example.com',
    })
  })

  it('fixture markup headline lists with raw title markers', () => {
    const headlines = listHeadlines(MARKUP, 'markup')
    const item = headlines[0]!
    expect(item.title).toContain('*bold*')
    expect(item.title).toContain('[[https://orgmode.org][Org mode]]')
    expect(item.tags).toContain('markup')
  })

  it('zero-edit and same-title splice leave markup file byte-identical', () => {
    expect(zeroEditWrite(MARKUP)).toBe(MARKUP)
    const h = listHeadlines(MARKUP, 'markup')[0]!
    expect(updateTitleInSource(MARKUP, h.path, h.title)).toBe(MARKUP)
  })
})

describe('structural editing (byte-splice)', () => {
  const TREE = `* Parent
:PROPERTIES:
:CREATED: [2026-09-05 Sat 09:30]
:END:
Parent body.

** Child A
Child A body.

** Child B
SCHEDULED: <2026-09-06 Sun>
#+BEGIN_SRC text
keep me
#+END_SRC

* Sibling
Sibling body.
`

  it('demotes headline and children, preserving drawers/body/src', () => {
    const parent = listHeadlines(TREE, 't').find((h) => h.title === 'Parent')!
    const next = demoteSubtreeInSource(TREE, parent.path)
    expect(next).toContain('** Parent')
    expect(next).toContain('*** Child A')
    expect(next).toContain('*** Child B')
    expect(next).toContain(':PROPERTIES:')
    expect(next).toContain(':CREATED: [2026-09-05 Sat 09:30]')
    expect(next).toContain(':END:')
    expect(next).toContain('Parent body.')
    expect(next).toContain('Child A body.')
    expect(next).toContain('SCHEDULED: <2026-09-06 Sun>')
    expect(next).toContain('#+BEGIN_SRC text')
    expect(next).toContain('keep me')
    expect(next).toContain('#+END_SRC')
    expect(next).toContain('* Sibling')
    expect(next.indexOf(':PROPERTIES:')).toBeGreaterThan(next.indexOf('** Parent'))
    const expected = TREE
      .replace('* Parent', '** Parent')
      .replace('** Child A', '*** Child A')
      .replace('** Child B', '*** Child B')
    expect(next).toBe(expected)
  })

  it('promotes subtree and refuses level-1 promote', () => {
    const child = listHeadlines(TREE, 't').find((h) => h.title === 'Child A')!
    const next = promoteSubtreeInSource(TREE, child.path)
    expect(next).toContain('* Child A')
    expect(next).toContain('Child A body.')
    expect(next).toBe(TREE.replace('** Child A', '* Child A'))

    const parent = listHeadlines(TREE, 't').find((h) => h.title === 'Parent')!
    expect(() => promoteSubtreeInSource(TREE, parent.path)).toThrow(RefuseWrite)
  })

  it('promote then demote round-trips bytes for a nested subtree', () => {
    const childB = listHeadlines(TREE, 't').find((h) => h.title === 'Child B')!
    const promoted = promoteSubtreeInSource(TREE, childB.path)
    expect(promoted).toContain('* Child B')
    const again = listHeadlines(promoted, 't').find((h) => h.title === 'Child B')!
    const demoted = demoteSubtreeInSource(promoted, again.path)
    expect(demoted).toBe(TREE)
  })

  it('moves subtree among siblings without smashing drawers/body', () => {
    const childB = listHeadlines(TREE, 't').find((h) => h.title === 'Child B')!
    const up = moveSubtreeInSource(TREE, childB.path, 'up')
    expect(up.indexOf('** Child B')).toBeLessThan(up.indexOf('** Child A'))
    expect(up).toContain(':PROPERTIES:')
    expect(up).toContain(':CREATED: [2026-09-05 Sat 09:30]')
    expect(up).toContain('SCHEDULED: <2026-09-06 Sun>')
    expect(up).toContain('#+BEGIN_SRC text')
    expect(up).toContain('keep me')
    expect(up).toContain('Child A body.')

    const childBAfter = listHeadlines(up, 't').find((h) => h.title === 'Child B')!
    const back = moveSubtreeInSource(up, childBAfter.path, 'down')
    expect(back).toBe(TREE)

    const sibling = listHeadlines(TREE, 't').find((h) => h.title === 'Sibling')!
    const top = moveSubtreeInSource(TREE, sibling.path, 'up')
    expect(top.indexOf('* Sibling')).toBeLessThan(top.indexOf('* Parent'))
    expect(top).toContain('Sibling body.')
    expect(top).toContain(':PROPERTIES:')
    expect(top).toContain('Parent body.')
  })

  it('inserts same-level heading after subtree without destroying body/drawers', () => {
    const parent = listHeadlines(TREE, 't').find((h) => h.title === 'Parent')!
    const next = insertHeadingInSource(TREE, parent.path, 'Inserted')
    expect(next).toContain('* Inserted\n')
    expect(next).toContain(':PROPERTIES:')
    expect(next).toContain('Parent body.')
    expect(next).toContain('** Child A')
    expect(next).toContain('** Child B')
    // New heading sits after Parent subtree, before Sibling
    const insertedAt = next.indexOf('* Inserted')
    expect(insertedAt).toBeGreaterThan(next.indexOf('#+END_SRC'))
    expect(insertedAt).toBeLessThan(next.indexOf('* Sibling'))
    // Original Parent block intact
    expect(next).toContain(TREE.slice(0, TREE.indexOf('* Sibling')))

    const childA = listHeadlines(TREE, 't').find((h) => h.title === 'Child A')!
    const nested = insertHeadingInSource(TREE, childA.path, 'Peer')
    expect(nested).toContain('** Peer\n')
    expect(nested.indexOf('** Peer')).toBeGreaterThan(nested.indexOf('Child A body.'))
    expect(nested.indexOf('** Peer')).toBeLessThan(nested.indexOf('** Child B'))
  })

  it('move no-ops at boundary; insert refuses newline titles', () => {
    const parent = listHeadlines(TREE, 't').find((h) => h.title === 'Parent')!
    expect(moveSubtreeInSource(TREE, parent.path, 'up')).toBe(TREE)
    expect(() => insertHeadingInSource(TREE, parent.path, 'bad\nline')).toThrow(RefuseWrite)
  })
})

describe('transparent tables (byte-splice)', () => {
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

  it('parses contiguous Org table blocks with offsets', () => {
    const tables = listTables(SAMPLE)
    expect(tables).toHaveLength(1)
    expect(tables[0]!.rows).toHaveLength(4)
    expect(tables[0]!.rows[0]).toEqual({ kind: 'standard', cells: ['Item', 'Qty'] })
    expect(tables[0]!.rows[1]).toEqual({ kind: 'rule', cells: [] })
    expect(tables[0]!.rows[2]).toEqual({ kind: 'standard', cells: ['eggs', '12'] })
    expect(tables[0]!.headlinePath).toEqual([0])
    const slice = SAMPLE.slice(tables[0]!.start, tables[0]!.end)
    expect(slice).toContain('| Item | Qty |')
    expect(slice).toContain('| eggs | 12')
  })

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
    // Emacs right-aligns a column whose non-header cells all parse as numbers
    // (Track A.2). These expectations were written before that landed.
    expect(out).toBe(
      `| Item | Qty |
|------+-----|
| eggs |  12 |
| milk |   1 |
`,
    )
  })

  it('updates one cell without touching outside bytes or reordering headlines', () => {
    const before = SAMPLE
    const next = updateTableCellInSource(before, 0, 2, 1, '24')
    expect(next).toContain('| eggs |  24 |') // numeric column is right-aligned
    expect(next).toContain('Keep this paragraph.')
    expect(next).toContain('* Other')
    expect(next).toContain('Unrelated body.')
    // Outside the table span must be byte-identical
    const table = listTables(before)[0]!
    expect(next.slice(0, table.start)).toBe(before.slice(0, table.start))
    // Trailing after original end may shift; compare suffix after table content via markers
    expect(next.indexOf('* Other')).toBeGreaterThan(next.indexOf('| milk'))
    expect(next.indexOf('* Groceries')).toBeLessThan(next.indexOf('* Other'))
    expect(changedRegions(before, next)).toBe(1)
    // Headline order unchanged
    const titles = listHeadlines(next, 't').map((h) => h.title)
    expect(titles).toEqual(['Groceries', 'Other'])
  })

  it('adds a row by splicing only the table region', () => {
    const before = SAMPLE
    const next = addTableRowInSource(before, 0)
    expect(next).toContain('|      |     |')
    expect(next).toContain('Keep this paragraph.')
    expect(next).toContain('* Other')
    expect(changedRegions(before, next)).toBe(1)
    const rows = listTables(next)[0]!.rows.filter((r) => r.kind === 'standard')
    expect(rows).toHaveLength(4)
  })

  it('preserves TBLFM and refuses unsafe cell values / rule edits', () => {
    const withFm = `* T
| a | b |
|---+---|
| 1 | 2 |
#+TBLFM: @2$2=1
`
    const next = updateTableCellInSource(withFm, 0, 2, 0, '9')
    expect(next).toContain('#+TBLFM: @2$2=1')
    expect(next).toContain('| 9')
    expect(next.slice(0, listTables(withFm)[0]!.start)).toBe(withFm.slice(0, listTables(withFm)[0]!.start))

    expect(() => updateTableCellInSource(SAMPLE, 0, 1, 0, 'x')).toThrow(RefuseWrite)
    expect(() => updateTableCellInSource(SAMPLE, 0, 2, 0, 'a|b')).toThrow(RefuseWrite)
    expect(() => updateTableCellInSource(SAMPLE, 0, 2, 0, 'a\nb')).toThrow(RefuseWrite)
  })
})

describe('superior source blocks (byte-splice)', () => {
  const SAMPLE = `#+TITLE: Src

* Example
#+BEGIN_SRC typescript -n
const x = 1
#+END_SRC

Keep this paragraph.

* Other
Unrelated body.
`

  it('parses src blocks with language, offsets, and interior body', () => {
    const blocks = listSrcBlocks(SAMPLE)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.language).toBe('typescript')
    expect(blocks[0]!.headlinePath).toEqual([0])
    expect(blocks[0]!.headerLine.toLowerCase()).toContain('#+begin_src typescript')
    expect(blocks[0]!.headerLine).toContain('-n')
    expect(blocks[0]!.body).toBe('const x = 1\n')
    const slice = SAMPLE.slice(blocks[0]!.start, blocks[0]!.end)
    expect(slice.startsWith('#+BEGIN_SRC')).toBe(true)
    expect(slice.endsWith('#+END_SRC')).toBe(true)
  })

  it('updates body without touching fences or outside bytes', () => {
    const before = SAMPLE
    const block = listSrcBlocks(before)[0]!
    const next = updateSrcBodyInSource(before, 0, 'const y = 2\n')
    expect(next).toContain('const y = 2')
    expect(next).toContain('#+BEGIN_SRC typescript -n')
    expect(next).toContain('#+END_SRC')
    expect(next).toContain('Keep this paragraph.')
    expect(next).toContain('* Other')
    expect(next).toContain('Unrelated body.')
    // Header + prefix before bodyStart byte-identical
    expect(next.slice(0, block.bodyStart)).toBe(before.slice(0, block.bodyStart))
    // End fence text preserved
    const nextBlock = listSrcBlocks(next)[0]!
    expect(before.slice(block.bodyEnd, block.end)).toBe(next.slice(nextBlock.bodyEnd, nextBlock.end))
    expect(changedRegions(before, next)).toBe(1)
    const titles = listHeadlines(next, 't').map((h) => h.title)
    expect(titles).toEqual(['Example', 'Other'])
  })

  it('preserves switches on header and normalizes trailing newline', () => {
    const before = SAMPLE
    const next = updateSrcBodyInSource(before, 0, 'no trailing newline')
    expect(normalizeSrcBody('no trailing newline')).toBe('no trailing newline\n')
    expect(next).toContain('#+BEGIN_SRC typescript -n\nno trailing newline\n#+END_SRC')
    expect(changedRegions(before, next)).toBe(1)
  })

  it('refuses bodies that inject #+END_SRC', () => {
    expect(() => updateSrcBodyInSource(SAMPLE, 0, 'ok\n#+END_SRC\nhacked\n')).toThrow(RefuseWrite)
    expect(() => updateSrcBodyInSource(SAMPLE, 99, 'x')).toThrow(RefuseWrite)
  })
})
