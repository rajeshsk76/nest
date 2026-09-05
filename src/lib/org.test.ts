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
  advanceRepeaterTimestamp,
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

  it('mark DONE on +1w advances date, resets to TODO, sets LAST_REPEAT (Emacs semantics)', () => {
    const headlines = listHeadlines(REPEATER, 'rep')
    const h = headlines.find((x) => x.title === 'Water plants')!
    const now = new Date(2026, 8, 6, 12, 17)
    const result = markDoneInSource(REPEATER, h.path, { now })

    expect(result).toContain('* TODO Water plants')
    expect(result).not.toContain('* DONE Water plants')
    expect(result).toContain('SCHEDULED: <2026-09-12 Sat +1w>')
    expect(result).toContain(':LAST_REPEAT: [2026-09-06 Sun 12:17]')
    expect(result).toContain('#+BEGIN_SRC emacs-lisp')
    expect(result).toContain('#+END_SRC')
    expect(result).not.toContain('#+begin_src')
    expect(result).toContain('#+MACRO: greeting Hello $1')
    // Blank line before BEGIN_SRC preserved after the new drawer
    expect(result).toMatch(/:END:\n\n#\+BEGIN_SRC/)
    expect(changedRegions(REPEATER, result)).toBeLessThanOrEqual(3)
  })

  it('non-repeater mark DONE still splices only the TODO token', () => {
    const src = `* TODO Plain task
SCHEDULED: <2026-09-05 Fri>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC
`
    const h = listHeadlines(src, 'plain')[0]!
    const result = markDoneInSource(src, h.path)
    expect(result).toBe(src.replace('* TODO Plain task', '* DONE Plain task'))
    expect(changedRegions(src, result)).toBe(1)
  })

  it('advances .+ and ++ repeaters from today (Emacs rules)', () => {
    const now = new Date(2026, 8, 6, 12, 17)
    expect(advanceRepeaterTimestamp('<2026-08-01 Sat .+1w>', now)).toBe(
      '<2026-09-13 Sun .+1w>',
    )
    expect(advanceRepeaterTimestamp('<2026-08-02 Sun ++1w>', now)).toBe(
      '<2026-09-13 Sun ++1w>',
    )
    expect(advanceRepeaterTimestamp('<2026-09-01 Tue +1m>', now)).toBe(
      '<2026-10-01 Thu +1m>',
    )
  })

  it('updates LAST_REPEAT inside an existing PROPERTIES drawer', () => {
    const src = `* TODO Water the plants                                              :home:
SCHEDULED: <2026-09-08 Tue 14:00 +1w>
:PROPERTIES:
:CREATED:  [2026-09-01 Tue 08:12]
:STYLE:    habit
:END:
Notes
`
    const h = listHeadlines(src, 'm')[0]!
    const now = new Date(2026, 8, 6, 12, 17)
    const result = markDoneInSource(src, h.path, { now })
    expect(result).toContain('SCHEDULED: <2026-09-15 Tue 14:00 +1w>')
    expect(result).toContain(':CREATED:  [2026-09-01 Tue 08:12]')
    expect(result).toContain(':STYLE:    habit')
    expect(result).toContain(':LAST_REPEAT: [2026-09-06 Sun 12:17]')
    expect(result).toContain('Notes')
    // Tag cookie spacing preserved (Emacs may re-pad; Nest does not)
    expect(result.split('\n')[0]).toBe(src.split('\n')[0])
  })

  it('zero-edit write is byte-identical', () => {
    expect(zeroEditWrite(REPEATER)).toBe(REPEATER)
    expect(zeroEditWrite(SAMPLE)).toBe(SAMPLE)
    // markDone with already-DONE is identity
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

