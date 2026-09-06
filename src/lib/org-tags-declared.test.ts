import { describe, expect, it } from 'vitest'
import { collectUniqueTags, tagsFrom } from './org'

describe('tagsFrom', () => {
  it('returns [] when no #+TAGS: line is present', () => {
    expect(tagsFrom('#+TITLE: Test\n\n* TODO Write tests\n')).toEqual([])
  })

  it('scrapes plain tag names', () => {
    expect(tagsFrom('#+TAGS: @work @home')).toEqual(['@work', '@home'])
  })

  it('strips the fast-access key syntax', () => {
    expect(tagsFrom('#+TAGS: laptop(l) server(s)')).toEqual(['laptop', 'server'])
  })

  it('unwraps mutually exclusive groups in { } but keeps their tags', () => {
    expect(tagsFrom('#+TAGS: { @work(w) @home(h) } urgent(u)')).toEqual([
      '@work',
      '@home',
      'urgent',
    ])
  })

  it('merges multiple #+TAGS: lines and dedupes', () => {
    const source = [
      '#+TAGS: @work @home',
      '#+TAGS: @home urgent(u)',
    ].join('\n')
    expect(tagsFrom(source)).toEqual(['@work', '@home', 'urgent'])
  })

  it('is case-insensitive on the #+TAGS: keyword itself', () => {
    expect(tagsFrom('#+tags: focus(f)')).toEqual(['focus'])
  })
})

describe('collectUniqueTags exposes declared #+TAGS:', () => {
  it('includes tags declared via #+TAGS: even when unused on any headline', () => {
    const source = [
      '#+TAGS: @work @home',
      '',
      '* TODO Write tests :urgent:',
    ].join('\n')
    expect(collectUniqueTags([{ id: 'a', source }])).toEqual(['@home', '@work', 'urgent'])
  })
})
