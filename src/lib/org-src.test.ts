import { describe, expect, it } from 'vitest'
import {
  RefuseWrite,
  listHeadlines,
  changedRegions,
  listSrcBlocks,
  updateSrcBodyInSource,
  normalizeSrcBody,
} from './org'

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
