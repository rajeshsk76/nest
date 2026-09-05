import { describe, expect, it } from 'vitest'
import {
  listHeadlines,
  markDoneInSource,
  parseOrg,
  stringifyOrg,
  zeroEditWrite,
} from './org'

/**
 * Core smoke tests. Repeater Mark DONE semantics live in org-repeater.test.ts
 * (Track A.1f). Full suite restoration tracked separately if needed.
 */
const SAMPLE = `#+TITLE: Test

* TODO Write tests
SCHEDULED: <2026-09-05 Sat>
Body text.

* DONE Already done
`

describe('org round-trip (smoke)', () => {
  it('parses and stringifies headlines with TODO keywords', () => {
    const out = stringifyOrg(parseOrg(SAMPLE))
    expect(out).toContain('* TODO Write tests')
    expect(out).toContain('* DONE Already done')
  })

  it('mark DONE splices TODO for non-repeater headlines', () => {
    const h = listHeadlines(SAMPLE, 'test').find((x) => x.title === 'Write tests')!
    expect(markDoneInSource(SAMPLE, h.path)).toContain('* DONE Write tests')
  })

  it('zero-edit write is byte-identical', () => {
    expect(zeroEditWrite(SAMPLE)).toBe(SAMPLE)
  })
})
