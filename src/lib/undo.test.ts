import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applyEditsTracked,
  assertOnlySpansChanged,
  changedRegions,
  listHeadlines,
  markDoneInSource,
  updateTitleInSource,
} from './org'
import { recordUndo, takeUndo, type UndoState } from './undo'

describe('one-level undo', () => {
  it('is unavailable without a snapshot', () => {
    expect(takeUndo({ previous: null })).toBeNull()
  })

  it('records the pre-edit source and consumes it without redo', () => {
    const recorded = recordUndo({ previous: null }, '* TODO Before\n')
    expect(recorded).toEqual({ previous: '* TODO Before\n' })
    const taken = takeUndo(recorded)!
    expect(taken).toEqual({ restore: '* TODO Before\n', state: { previous: null } })
    expect(takeUndo(taken.state)).toBeNull()
  })

  it('replaces the previous snapshot instead of retaining a stack', () => {
    const first = recordUndo({ previous: null }, 'first')
    const second = recordUndo(first, 'second')
    const taken = takeUndo(second)!
    expect(taken.restore).toBe('second')
    expect(takeUndo(taken.state)).toBeNull()
    expect(first).toEqual({ previous: 'first' })
  })

  it('records a new edit after undo as a fresh single level', () => {
    const taken = takeUndo(recordUndo({ previous: null }, 'before'))!
    const next = recordUndo(taken.state, taken.restore)
    expect(takeUndo(next)).toEqual({ restore: 'before', state: { previous: null } })
  })

  it('distinguishes an empty file from no snapshot', () => {
    expect(takeUndo(recordUndo({ previous: 'older' }, ''))).toEqual({
      restore: '', state: { previous: null },
    })
  })

  it('does not mutate input states or share the returned empty state', () => {
    const original: UndoState = Object.freeze({ previous: 'saved' })
    expect(recordUndo(original, 'new')).toEqual({ previous: 'new' })
    const a = takeUndo(original)!
    const b = takeUndo(original)!
    a.state.previous = 'independent'
    expect(b.state.previous).toBeNull()
    expect(original.previous).toBe('saved')
  })

  it.each(['', '\n', '\r\n', '  \t\r\n', 'café 🪺\r\nno final newline'])('restores exact bytes for %j', (source) => {
    const taken = takeUndo(recordUndo({ previous: null }, source))!
    expect(taken.restore).toBe(source)
    expect(Buffer.from(taken.restore)).toEqual(Buffer.from(source))
  })

  it('restores the real messy corpus after a real title splice', () => {
    const source = readFileSync('fixtures/corpus/messy.org', 'utf8')
    const path = listHeadlines(source, 'inbox')[0]!.path
    const after = updateTitleInSource(source, path, 'Changed title')
    expect(after).not.toBe(source)
    const taken = takeUndo(recordUndo({ previous: null }, source))!
    expect(Buffer.from(taken.restore)).toEqual(Buffer.from(source))
    expect(changedRegions(taken.restore, after)).toBe(1)
  })

  it('retains an exact snapshot across a multi-region repeater edit', () => {
    const source = '* TODO Water plants\nSCHEDULED: <2026-09-05 Sat +1w>\n\n#+BEGIN_SRC sh\necho untouched\n#+END_SRC\n'
    const after = markDoneInSource(source, listHeadlines(source, 'inbox')[0]!.path)
    expect(after).not.toBe(source)
    expect(after).toContain(':LAST_REPEAT:')
    const taken = takeUndo(recordUndo({ previous: null }, source))!
    expect(taken.restore).toBe(source)
    // App rechecks the original accepted edit, using its original limit.
    expect(changedRegions(taken.restore, after)).toBeGreaterThan(0)
    expect(changedRegions(taken.restore, after)).toBeLessThanOrEqual(3)
  })

  it('restores the exact source covered by the original declared spans', () => {
    const source = '* TODO First\r\nuntouched café\r\n* TODO Second\r\n'
    const result = applyEditsTracked(source, [
      { start: source.indexOf('First'), end: source.indexOf('First') + 5, text: 'A longer title' },
      { start: source.indexOf('Second'), end: source.indexOf('Second') + 6, text: 'Short' },
    ])
    const taken = takeUndo(recordUndo({ previous: null }, source))!
    expect(taken.restore).toBe(source)
    expect(() => assertOnlySpansChanged(taken.restore, result.next, result.edits)).not.toThrow()
    expect(result.next).toContain('\r\nuntouched café\r\n')
    expect(takeUndo(taken.state)).toBeNull()
  })
})
