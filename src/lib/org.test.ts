import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  captureTodo,
  collectTodayAgenda,
  demoteSubtreeInSource,
  filterTodayItems,
  insertHeadingInSource,
  listHeadlines,
  markDoneInSource,
  moveSubtreeInSource,
  promoteSubtreeInSource,
  RefuseWrite,
  parseCaptureTitle,
  parseOrg,
  changedRegions,
  roundTrip,
  stringifyOrg,
  updateDeadlineInSource,
  updatePriorityInSource,
  updateScheduledInSource,
  updateTagsInSource,
  updateTodoInSource,
  zeroEditWrite,
  parseInlineMarkup,
  updateTitleInSource,
  listTables,
  serializeOrgTable,
  updateTableCellInSource,
  addTableRowInSource,
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

describe('org round-trip', () => {
  it('parses and stringifies headlines with TODO keywords', () => {
    const tree = parseOrg(SAMPLE)
    const out = stringifyOrg(tree)
    expect(out).toContain('* TODO Write tests')
    expect(out).toContain('* DONE Already done')
    expect(out).toContain('** TODO Nested task')
    expect(out).toContain('SCHEDULED: <2026-09-05 Sat>')
  })

  it('round-trips without losing TODO/DONE lines', () => {
    const again = roundTrip(SAMPLE)
    expect(again).toContain('* TODO Write tests')
    expect(again).toContain('DEADLINE: <2026-09-05 Sat>')
  })

  it('lists headlines with planning dates', () => {
    const headlines = listHeadlines(SAMPLE, 'test')
    const write = headlines.find((h) => h.title === 'Write tests')
    expect(write?.todo).toBe('TODO')
    expect(write?.scheduledDate).toEqual({ year: 2026, month: 9, day: 5 })
  })

  it('updates TODO to DONE via byte-splice', () => {
    const headlines = listHeadlines(SAMPLE, 'test')
    const write = headlines.find((h) => h.title === 'Write tests')!
    const next = updateTodoInSource(SAMPLE, write.path, 'DONE')
    expect(next).toContain('* DONE Write tests')
    const marked = markDoneInSource(SAMPLE, write.path)
    expect(marked).toContain('* DONE Write tests')
  })

  it('captures a TODO into inbox content with CREATED always', () => {
    const now = new Date('2026-09-05T09:30:00')
    const next = captureTodo('* TODO Existing\n', 'Ship Nest', { now })
    expect(next).toContain('* TODO Existing')
    expect(next).toContain('* TODO Ship Nest')
    expect(next).toContain(':PROPERTIES:')
    expect(next).toContain(':CREATED: [2026-09-05 Sat 09:30]')
    expect(next).toContain(':END:')
  })

  it('collects today agenda items', () => {
    const items = collectTodayAgenda(
      [{ id: 'test', source: SAMPLE }],
      new Date('2026-09-05T12:00:00'),
    )
    const titles = items.map((i) => i.title)
    expect(titles).toContain('Write tests')
    expect(titles).toContain('Nested task')
    expect(titles).not.toContain('Already done')
  })
})

describe('priority and tags', () => {
  it('parses priority cookies and tags from headlines', () => {
    const headlines = listHeadlines(TAGGED, 'tagged')
    const high = headlines.find((h) => h.title === 'High priority work')
    expect(high?.priority).toBe('A')
    expect(high?.tags).toEqual(['work', 'urgent'])
    const medium = headlines.find((h) => h.title === 'Medium chore')
    expect(medium?.priority).toBe('B')
    expect(medium?.tags).toEqual(['home'])
  })

  it('round-trips priority and tags through stringify', () => {
    const out = roundTrip(TAGGED)
    expect(out).toContain('* TODO [#A] High priority work :work:urgent:')
    expect(out).toContain('* TODO [#B] Medium chore :home:')
    expect(out).toContain('* TODO [#C] Low backlog :nest:')
  })

  it('updates priority in source', () => {
    const headlines = listHeadlines(TAGGED, 'tagged')
    const high = headlines.find((h) => h.title === 'High priority work')!
    const next = updatePriorityInSource(TAGGED, high.path, 'B')
    expect(next).toContain('* TODO [#B] High priority work :work:urgent:')
    const cleared = updatePriorityInSource(next, high.path, null)
    expect(cleared).toContain('* TODO High priority work :work:urgent:')
    expect(cleared).not.toMatch(/High priority work.*\[#/)
  })

  it('updates tags in source', () => {
    const headlines = listHeadlines(TAGGED, 'tagged')
    const high = headlines.find((h) => h.title === 'High priority work')!
    const next = updateTagsInSource(TAGGED, high.path, ['work', 'focus'])
    expect(next).toContain('* TODO [#A] High priority work :work:focus:')
    const cleared = updateTagsInSource(next, high.path, [])
    expect(cleared).toContain('* TODO [#A] High priority work')
    expect(cleared).not.toContain(':work:')
  })

  it('parses capture title for #A / [#B] and :tags:', () => {
    expect(parseCaptureTitle('Ship Nest #A :work:urgent:')).toEqual({
      title: 'Ship Nest',
      priority: 'A',
      tags: ['work', 'urgent'],
    })
    expect(parseCaptureTitle('[#C] Buy milk :errands:')).toEqual({
      title: 'Buy milk',
      priority: 'C',
      tags: ['errands'],
    })
    expect(parseCaptureTitle('Plain capture')).toEqual({
      title: 'Plain capture',
      priority: null,
      tags: [],
    })
  })

  it('captures with priority and tags into inbox', () => {
    const now = new Date('2026-09-05T09:30:00')
    const next = captureTodo('* TODO Existing\n', 'Ship Nest #A :work:', { now })
    expect(next).toContain('* TODO [#A] Ship Nest :work:')
    expect(next).toContain(':CREATED: [2026-09-05 Sat 09:30]')
    const headlines = listHeadlines(next, 'inbox')
    const ship = headlines.find((h) => h.title === 'Ship Nest')
    expect(ship?.priority).toBe('A')
    expect(ship?.tags).toEqual(['work'])
  })

  it('sorts today agenda by priority A → B → C → none', () => {
    const items = collectTodayAgenda(
      [{ id: 'tagged', source: TAGGED }],
      new Date('2026-09-05T12:00:00'),
    )
    const titles = items.map((i) => i.title)
    expect(titles.indexOf('High priority work')).toBeLessThan(
      titles.indexOf('Medium chore'),
    )
    expect(titles.indexOf('Medium chore')).toBeLessThan(titles.indexOf('Low backlog'))
    expect(titles.indexOf('Low backlog')).toBeLessThan(
      titles.indexOf('Untagged open task'),
    )
  })

  it('filters today items by priority and tag', () => {
    const items = collectTodayAgenda(
      [{ id: 'tagged', source: TAGGED }],
      new Date('2026-09-05T12:00:00'),
    )
    const onlyA = filterTodayItems(items, { priorities: ['A'], tags: [] })
    expect(onlyA.map((i) => i.title)).toEqual(['High priority work'])

    const work = filterTodayItems(items, { priorities: [], tags: ['work'] })
    expect(work.map((i) => i.title)).toEqual(['High priority work'])

    const none = filterTodayItems(items, { priorities: ['none'], tags: [] })
    expect(none.map((i) => i.title)).toEqual(['Untagged open task'])

    const empty = filterTodayItems(items, { priorities: [], tags: [] })
    expect(empty).toHaveLength(items.length)
  })
})

/**
 * Compat badge — headline + TODO + priority + tags + CREATED + SCHEDULED
 * must survive parse → stringify. CI runs this suite on every push/PR.
 */
describe('Org compat badge (round-trip)', () => {
  const COMPAT = `* TODO [#A] Compat check :nest:ci:
SCHEDULED: <2026-09-06 Sun>
:PROPERTIES:
:CREATED: [2026-09-05 Sat 09:30]
:END:
`

  it('preserves headline, TODO, priority, tags, CREATED, SCHEDULED', () => {
    const out = roundTrip(COMPAT)
    expect(out).toBe(COMPAT)

    const headlines = listHeadlines(out, 'compat')
    expect(headlines).toHaveLength(1)
    const h = headlines[0]!
    expect(h.todo).toBe('TODO')
    expect(h.priority).toBe('A')
    expect(h.tags).toEqual(['nest', 'ci'])
    expect(h.title).toBe('Compat check')
    expect(h.scheduledDate).toEqual({ year: 2026, month: 9, day: 6 })
  })

  it('capture always emits CREATED and round-trips cleanly', () => {
    const now = new Date('2026-09-05T09:30:00')
    const captured = captureTodo('', 'Compat check #A :nest:', { now })
    expect(captured).toContain('* TODO [#A] Compat check :nest:')
    expect(captured).toMatch(/:CREATED:\s*\[2026-09-05 Sat 09:30\]/)
    const again = roundTrip(captured)
    expect(again).toContain('* TODO [#A] Compat check :nest:')
    expect(again).toContain(':CREATED:')
    expect(again).toContain(':PROPERTIES:')
  })

  it('SCHEDULED / DEADLINE setters write real Org timestamps', () => {
    const base = '* TODO Plan week\n'
    const withSched = updateScheduledInSource(base, [0], {
      year: 2026,
      month: 9,
      day: 7,
    })
    expect(withSched).toContain('SCHEDULED: <2026-09-07 Mon>')
    const withBoth = updateDeadlineInSource(withSched, [0], {
      year: 2026,
      month: 9,
      day: 8,
    })
    expect(withBoth).toContain('DEADLINE: <2026-09-08 Tue>')
    expect(roundTrip(withBoth)).toContain('SCHEDULED: <2026-09-07 Mon>')
    expect(roundTrip(withBoth)).toContain('DEADLINE: <2026-09-08 Tue>')
  })
})

describe('byte fidelity against a real corpus file', () => {
  const CORPUS = readFileSync(new URL('../fixtures/inbox.org', import.meta.url), 'utf8')

  it('marking DONE changes exactly one line and nothing else', () => {
    const out = markDoneInSource(CORPUS, [0])
    expect(changedRegions(CORPUS, out)).toBe(1)
    expect(out.split('\n').filter((l, i) => l !== CORPUS.split('\n')[i])).toHaveLength(1)
  })

  it('moving SCHEDULED keeps repeaters and time of day', () => {
    const src = '* TODO habit\nSCHEDULED: <2026-09-08 Tue 14:00 +1w>\n'
    expect(updateScheduledInSource(src, [0], { year: 2026, month: 9, day: 9 })).toBe(
      '* TODO habit\nSCHEDULED: <2026-09-09 Wed 14:00 +1w>\n',
    )
  })

  it('honours a file-local #+TODO: keyword set', () => {
    const src = '#+TODO: TODO NEXT | DONE\n* NEXT ship it\n'
    expect(updateTodoInSource(src, [0], 'DONE')).toBe('#+TODO: TODO NEXT | DONE\n* DONE ship it\n')
  })
})

describe('byte-splice Org writes', () => {
  const REPEATER = `* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
`

  it('mark DONE splices only the TODO token (preserves +1w, BEGIN_SRC case, blanks)', () => {
    const headlines = listHeadlines(REPEATER, 'rep')
    const h = headlines.find((x) => x.title === 'Water plants')!
    const result = markDoneInSource(REPEATER, h.path)

    expect(result).toContain('* DONE Water plants')
    expect(result).toContain('SCHEDULED: <2026-09-05 Fri +1w>')
    expect(result).toContain('#+BEGIN_SRC emacs-lisp')
    expect(result).toContain('#+END_SRC')
    expect(result).not.toContain('#+begin_src')
    expect(result).toMatch(/SCHEDULED: <2026-09-05 Fri \+1w>\n\n#\+BEGIN_SRC/)
    const expected = REPEATER.replace('* TODO Water plants', '* DONE Water plants')
    expect(result).toBe(expected)
  })

  it('zero-edit write is byte-identical', () => {
    expect(zeroEditWrite(REPEATER)).toBe(REPEATER)
    expect(zeroEditWrite(SAMPLE)).toBe(SAMPLE)
    const doneSrc = '* DONE Already\n'
    const headlines = listHeadlines(doneSrc, 'd')
    const result = markDoneInSource(doneSrc, headlines[0]!.path)
    expect(result).toBe(doneSrc)
  })

  it('refuses splice when path is invalid', () => {
    expect(() => updateTodoInSource(SAMPLE, [99], 'DONE')).toThrow(RefuseWrite)
  })

  it('cycles TODO → DONE → null via splice without rewriting the rest', () => {
    const base = `#+TITLE: Keep\n\n* TODO Task\nBody keeps blank lines.\n\n#+BEGIN_SRC text\nok\n#+END_SRC\n`
    const h = listHeadlines(base, 'c')[0]!
    const done = updateTodoInSource(base, h.path, 'DONE')
    expect(done).toBe(base.replace('* TODO Task', '* DONE Task'))
    const cleared = updateTodoInSource(done, h.path, null)
    expect(cleared).toBe(base.replace('* TODO Task', '* Task'))
    expect(cleared).toContain('#+BEGIN_SRC text')
  })
})

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
    const insertedAt = next.indexOf('* Inserted')
    expect(insertedAt).toBeGreaterThan(next.indexOf('#+END_SRC'))
    expect(insertedAt).toBeLessThan(next.indexOf('* Sibling'))
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
    expect(out).toBe(
      `| Item | Qty |
|------+-----|
| eggs | 12  |
| milk | 1   |
`,
    )
  })

  it('updates one cell without touching outside bytes or reordering headlines', () => {
    const before = SAMPLE
    const next = updateTableCellInSource(before, 0, 2, 1, '24')
    expect(next).toContain('| eggs | 24')
    expect(next).toContain('Keep this paragraph.')
    expect(next).toContain('* Other')
    expect(next).toContain('Unrelated body.')
    const table = listTables(before)[0]!
    expect(next.slice(0, table.start)).toBe(before.slice(0, table.start))
    expect(next.indexOf('* Other')).toBeGreaterThan(next.indexOf('| milk'))
    expect(next.indexOf('* Groceries')).toBeLessThan(next.indexOf('* Other'))
    expect(changedRegions(before, next)).toBe(1)
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
