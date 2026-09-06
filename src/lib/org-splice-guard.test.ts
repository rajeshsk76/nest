import { describe, expect, it } from 'vitest'

import {
  applyEditsTracked,
  assertOnlySpansChanged,
  isSpliceResult,
  RefuseWrite,
} from './org-core'

const SRC = `* G [/]
- [ ] a [0/1]
  - [ ] b [0/2]
    - [ ] c1
    - [ ] c2
`

describe('declared-span write guard', () => {
  it('accepts several non-adjacent spans from one action', () => {
    // What a checkbox toggle looks like: box, two ancestor states, two cookies.
    const lines = SRC.split('\n')
    const off = (n: number) => lines.slice(0, n).join('\n').length + (n > 0 ? 1 : 0)
    const { next, edits } = applyEditsTracked(SRC, [
      { start: off(3) + 4, end: off(3) + 9, text: '- [X]' },
      { start: off(2) + 2, end: off(2) + 7, text: '- [-]' },
      { start: off(1) + 0, end: off(1) + 5, text: '- [-]' },
    ])
    expect(edits).toHaveLength(3)
    expect(edits[0]!.start).toBeLessThan(edits[1]!.start) // normalised order
    expect(() => assertOnlySpansChanged(SRC, next, edits)).not.toThrow()
    expect(next).toContain('- [X] c1')
    expect(next).toContain('- [-] b')
  })

  it('refuses a byte that moved outside a declared span', () => {
    const { next, edits } = applyEditsTracked(SRC, [
      { start: 0, end: 1, text: '*' },
    ])
    const tampered = `${next}trailing junk\n`
    expect(() => assertOnlySpansChanged(SRC, tampered, edits)).toThrow(RefuseWrite)
  })

  it('refuses when a mutator declares nothing', () => {
    expect(() => assertOnlySpansChanged(SRC, SRC, [])).toThrow(RefuseWrite)
  })

  it('leaves every byte outside the spans identical', () => {
    const { next, edits } = applyEditsTracked(SRC, [
      { start: 0, end: 1, text: '*' },
    ])
    const e = edits[0]!
    expect(next.slice(e.end)).toBe(SRC.slice(e.end))
  })

  it('distinguishes a SpliceResult from a bare string', () => {
    expect(isSpliceResult('* x\n')).toBe(false)
    expect(isSpliceResult({ next: '* x\n', edits: [] })).toBe(true)
  })
})
