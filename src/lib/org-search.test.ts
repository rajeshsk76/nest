import { describe, expect, it } from 'vitest'
import { filterHeadlines, parseTagQuery, searchHeadlines } from './org-search'

describe('searchHeadlines', () => {
  it('matches a title substring, case-insensitively', () => {
    const source = '* TODO Buy milk\nSome notes about the errand.\n'
    const hits = searchHeadlines({ f1: source }, 'MILK')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.title).toBe('Buy milk')
    expect(hits[0]!.matchedIn).toBe('title')
  })

  it('matches a body substring when the title does not match', () => {
    const source = '* Groceries\nNeed to buy oranges and bread.\n'
    const hits = searchHeadlines({ f1: source }, 'oranges')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.title).toBe('Groceries')
    expect(hits[0]!.matchedIn).toBe('body')
  })

  it('inherits tags from #+FILETAGS:', () => {
    const source = '#+FILETAGS: :work:\n* Standalone task\n'
    const hits = searchHeadlines({ f1: source }, 'Standalone')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.tags).toContain('work')
  })

  it('inherits tags from every ancestor headline', () => {
    const source = '* Parent :urgent:\n** Child\nSome body text.\n'
    const hits = searchHeadlines({ f1: source }, 'Child')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.title).toBe('Child')
    expect(hits[0]!.tags).toContain('urgent')
  })

  it('returns nothing for a query with no match', () => {
    const source = '* Just a task\nNothing special here.\n'
    const hits = searchHeadlines({ f1: source }, 'nonexistentxyz')
    expect(hits).toHaveLength(0)
  })
})

describe('parseTagQuery + filterHeadlines', () => {
  it('applies +require-exclude', () => {
    const source = '* A :work:\n* B :work:urgent:\n* C :urgent:\n'
    const hits = searchHeadlines({ f1: source }, '')
    const q = parseTagQuery('+work-urgent')
    expect(q.require).toEqual(['work'])
    expect(q.exclude).toEqual(['urgent'])

    const filtered = filterHeadlines(hits, q)
    expect(filtered.map((h) => h.title)).toEqual(['A'])
  })

  it('applies an any-of group with |', () => {
    const source = '* A :work:\n* B :home:\n* C :personal:\n'
    const hits = searchHeadlines({ f1: source }, '')
    const q = parseTagQuery('work|home')
    expect(q.anyOf).toEqual([['work', 'home']])

    const filtered = filterHeadlines(hits, q)
    expect(filtered.map((h) => h.title).sort()).toEqual(['A', 'B'])
  })

  it('matches a PROP="value" clause against a special property', () => {
    const source = '* [#A] Important task\n* [#B] Less important\n'
    const hits = searchHeadlines({ f1: source }, '')
    const q = parseTagQuery('PRIORITY="A"')
    expect(q.props).toEqual([{ key: 'PRIORITY', op: '=', value: 'A' }])

    const filtered = filterHeadlines(hits, q)
    expect(filtered.map((h) => h.title)).toEqual(['Important task'])
  })
})
