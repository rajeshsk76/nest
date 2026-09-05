import { describe, expect, it } from 'vitest'
import {
  captureTodo,
  collectTodayAgenda,
  listHeadlines,
  markDoneInSource,
  parseOrg,
  roundTrip,
  stringifyOrg,
  updateTodoInSource,
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

  it('updates TODO to DONE and stringifies back', () => {
    const headlines = listHeadlines(SAMPLE, 'test')
    const write = headlines.find((h) => h.title === 'Write tests')!
    const next = updateTodoInSource(SAMPLE, write.path, 'DONE')
    expect(next).toContain('* DONE Write tests')
    expect(markDoneInSource(SAMPLE, write.path)).toContain('* DONE Write tests')
  })

  it('captures a TODO into inbox content', () => {
    const now = new Date('2026-09-05T09:30:00')
    const next = captureTodo('* TODO Existing\n', 'Ship Nest', { now })
    expect(next).toContain('* TODO Existing')
    expect(next).toContain('* TODO Ship Nest')
    expect(next).toContain(':CREATED:')
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
