import { describe, expect, it } from 'vitest'
import { drawersExpandedByDefault, listDrawers } from './org-drawers'

describe('listDrawers', () => {
  it('returns nothing when there are no drawers', () => {
    expect(listDrawers('* TODO Buy milk\nSome body text.\n')).toEqual([])
  })

  it('finds a :PROPERTIES: drawer under its headline', () => {
    const source = ['* TODO Buy milk', ':PROPERTIES:', ':CLIENT: acme', ':END:', ''].join('\n')
    const drawers = listDrawers(source)
    expect(drawers).toHaveLength(1)
    expect(drawers[0]!.kind).toBe('properties')
    expect(drawers[0]!.headlinePath).toEqual([0])
    expect(drawers[0]!.raw).toBe(source.slice(drawers[0]!.start, drawers[0]!.end))
    expect(drawers[0]!.raw.startsWith(':PROPERTIES:')).toBe(true)
    expect(drawers[0]!.raw.trim().endsWith(':END:')).toBe(true)
  })

  it('finds a :LOGBOOK: drawer and ignores other custom drawer names', () => {
    const source = [
      '* DONE Buy milk',
      ':LOGBOOK:',
      '- State "DONE"       from "TODO"       [2026-01-01 Thu 09:00]',
      ':END:',
      ':NOTES:',
      'not tracked',
      ':END:',
      '',
    ].join('\n')
    const drawers = listDrawers(source)
    expect(drawers).toHaveLength(1)
    expect(drawers[0]!.kind).toBe('logbook')
    expect(drawers[0]!.raw).toContain('State "DONE"')
  })

  it('is case-insensitive on the LOGBOOK drawer name', () => {
    const source = ['* TODO Buy milk', ':logbook:', ':END:', ''].join('\n')
    expect(listDrawers(source)[0]!.kind).toBe('logbook')
  })

  it('orders drawers by position and reports both under one headline', () => {
    const source = [
      '* DONE Buy milk',
      ':PROPERTIES:',
      ':CLIENT: acme',
      ':END:',
      ':LOGBOOK:',
      '- State "DONE"       from "TODO"       [2026-01-01 Thu 09:00]',
      ':END:',
      '',
    ].join('\n')
    const drawers = listDrawers(source)
    expect(drawers.map((d) => d.kind)).toEqual(['properties', 'logbook'])
    expect(drawers.map((d) => d.index)).toEqual([0, 1])
    expect(drawers[0]!.headlinePath).toEqual([0])
    expect(drawers[1]!.headlinePath).toEqual([0])
  })

  it('attaches a nested headline drawer to its own path, not the parent', () => {
    const source = [
      '* Parent',
      ':PROPERTIES:',
      ':ID: 1',
      ':END:',
      '** Child',
      ':PROPERTIES:',
      ':ID: 2',
      ':END:',
      '',
    ].join('\n')
    const drawers = listDrawers(source)
    expect(drawers).toHaveLength(2)
    expect(drawers[0]!.headlinePath).toEqual([0])
    expect(drawers[1]!.headlinePath).toEqual([0, 0])
  })
})

describe('drawersExpandedByDefault', () => {
  it('is collapsed with no #+STARTUP: line', () => {
    expect(drawersExpandedByDefault('#+TITLE: Test\n')).toBe(false)
  })

  it('stays collapsed for overview and content', () => {
    expect(drawersExpandedByDefault('#+STARTUP: overview\n')).toBe(false)
    expect(drawersExpandedByDefault('#+STARTUP: content\n')).toBe(false)
  })

  it('opens for showall', () => {
    expect(drawersExpandedByDefault('#+STARTUP: showall\n')).toBe(true)
  })
})
