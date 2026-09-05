import { describe, expect, it } from 'vitest'
import {
  changedRegions,
  listHeadlines,
  markDoneInSource,
  advanceRepeaterTimestamp,
  zeroEditWrite,
} from './org'

const REPEATER = `* TODO Water plants
SCHEDULED: <2026-09-05 Fri +1w>

#+BEGIN_SRC emacs-lisp
(message "fragile")
#+END_SRC

#+MACRO: greeting Hello $1
`

describe('repeater Mark DONE (LAST_REPEAT / advanceRepeater)', () => {
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
})
