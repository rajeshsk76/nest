import { describe, expect, it } from 'vitest'
import { startupOptionsFrom } from './org'

describe('startupOptionsFrom', () => {
  it('returns all-null defaults when no #+STARTUP: line is present', () => {
    expect(startupOptionsFrom('#+TITLE: Test\n')).toEqual({
      visibility: null,
      logDone: null,
      logRepeat: null,
    })
  })

  it('scrapes overview/content/showall visibility keywords', () => {
    expect(startupOptionsFrom('#+STARTUP: overview').visibility).toBe('overview')
    expect(startupOptionsFrom('#+STARTUP: content').visibility).toBe('content')
    expect(startupOptionsFrom('#+STARTUP: showall').visibility).toBe('showall')
  })

  it('scrapes logdone/nologdone and logrepeat/nologrepeat', () => {
    expect(startupOptionsFrom('#+STARTUP: logdone').logDone).toBe(true)
    expect(startupOptionsFrom('#+STARTUP: nologdone').logDone).toBe(false)
    expect(startupOptionsFrom('#+STARTUP: logrepeat').logRepeat).toBe(true)
    expect(startupOptionsFrom('#+STARTUP: nologrepeat').logRepeat).toBe(false)
  })

  it('combines keywords on one line', () => {
    expect(startupOptionsFrom('#+STARTUP: content logdone nologrepeat')).toEqual({
      visibility: 'content',
      logDone: true,
      logRepeat: false,
    })
  })

  it('lets a later #+STARTUP: line override an earlier one', () => {
    const source = ['#+STARTUP: overview logdone', '#+STARTUP: showall nologdone'].join('\n')
    expect(startupOptionsFrom(source)).toEqual({
      visibility: 'showall',
      logDone: false,
      logRepeat: null,
    })
  })
})
