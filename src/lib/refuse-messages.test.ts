import { describe, expect, it } from 'vitest'
import { RefuseWrite } from './org-core'
import { plainRefuseMessage, plainRegionsRefuseMessage } from './refuse-messages'

describe('plainRefuseMessage', () => {
  it('maps bad dates calmly', () => {
    expect(plainRefuseMessage(new RefuseWrite('unrecognised timestamp: <nope>'))).toBe(
      "Nest didn't recognise that date format, so it left the file alone.",
    )
  })

  it('maps title newline, table pipe, overlapping edits', () => {
    expect(plainRefuseMessage(new RefuseWrite('title contains a newline'))).toMatch(/line break/)
    expect(plainRefuseMessage(new RefuseWrite('table cell contains a pipe'))).toMatch(/pipe/)
    expect(plainRefuseMessage(new RefuseWrite('overlapping edits'))).toMatch(/overlapping/)
  })

  it('maps region refuse', () => {
    expect(plainRegionsRefuseMessage('inbox', 4)).toMatch(/4 separate parts of inbox\.org/)
  })
})
