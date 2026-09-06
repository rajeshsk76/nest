import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { OutlineEditor } from './OutlineEditor'

const edit = vi.fn()
const baseProps = {
  fileId: 'inbox',
  onCycleTodo: edit,
  onRename: edit,
  onSetPriority: edit,
  onSetTags: edit,
  onSetScheduled: edit,
  onSetDeadline: edit,
  onPromote: edit,
  onDemote: edit,
  onMove: edit,
  onInsertHeading: edit,
  onUpdateTableCell: edit,
  onAddTableRow: edit,
  onUpdateSrcBody: edit,
}

function render(source: string) {
  return renderToStaticMarkup(createElement(OutlineEditor, { ...baseProps, source }))
}

describe('B4 drawer display', () => {
  it('collapses :PROPERTIES: and :LOGBOOK: drawers by default', () => {
    const html = render(
      [
        '* DONE Buy milk',
        ':PROPERTIES:',
        ':CLIENT: acme',
        ':END:',
        ':LOGBOOK:',
        '- State "DONE"       from "TODO"       [2026-01-01 Thu 09:00]',
        ':END:',
        '',
      ].join('\n'),
    )
    expect(html).toContain(':PROPERTIES:')
    expect(html).toContain(':LOGBOOK:')
    expect(html).not.toContain('CLIENT: acme')
    expect(html).not.toContain('State')
  })

  it('expands drawers by default when #+STARTUP: showall is set', () => {
    const html = render(
      ['#+STARTUP: showall', '* DONE Buy milk', ':PROPERTIES:', ':CLIENT: acme', ':END:', ''].join('\n'),
    )
    expect(html).toContain('CLIENT: acme')
  })

  it('stays collapsed for overview and content startup visibility', () => {
    for (const level of ['overview', 'content']) {
      const html = render(
        [`#+STARTUP: ${level}`, '* DONE Buy milk', ':PROPERTIES:', ':CLIENT: acme', ':END:', ''].join(
          '\n',
        ),
      )
      expect(html).not.toContain('CLIENT: acme')
    }
  })

  it('does not add a toggle for drawer names it does not track', () => {
    const html = render(['* TODO Buy milk', ':NOTES:', 'not tracked', ':END:', ''].join('\n'))
    expect(html).not.toContain('drawer-toggle')
  })

  it('never invokes an edit callback from rendering alone', () => {
    render(
      ['* DONE Buy milk', ':PROPERTIES:', ':CLIENT: acme', ':END:', ''].join('\n'),
    )
    expect(edit).not.toHaveBeenCalled()
  })
})
