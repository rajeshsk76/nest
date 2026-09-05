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
