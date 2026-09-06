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
  onToggleCheckbox: edit,
}

function render(source: string) {
  return renderToStaticMarkup(createElement(OutlineEditor, { ...baseProps, source }))
}

describe('checklist display', () => {
  it('renders an unchecked and a checked box with their text', () => {
    const html = render(['* Groceries', '- [ ] Milk', '- [X] Eggs', ''].join('\n'))
    expect(html).toContain('checklist-box')
    expect(html).toContain('Milk')
    expect(html).toContain('Eggs')
    expect(html).toContain('☐')
    expect(html).toContain('☒')
  })

  it('renders a statistics cookie next to its item', () => {
    const html = render(
      ['* Project', '- [ ] Parent [0/2]', '  - [ ] A', '  - [ ] B', ''].join('\n'),
    )
    expect(html).toContain('checklist-cookie')
    expect(html).toContain('[0/2]')
  })

  it('renders nested checklist items under the same headline', () => {
    const html = render(['* Project', '- [ ] Parent', '  - [ ] Child', ''].join('\n'))
    expect(html).toContain('Parent')
    expect(html).toContain('Child')
  })

  it('renders no checklist markup for a file with no checkboxes', () => {
    const html = render(['* Just a task', 'Nothing to check here.', ''].join('\n'))
    expect(html).not.toContain('checklist-box')
  })

  it('renders a checklist that sits before the first headline at file root', () => {
    const html = render(['- [ ] Root item', '* Project', 'Some notes.', ''].join('\n'))
    expect(html).toContain('Root item')
  })

  it('never invokes the toggle callback from rendering alone', () => {
    render(['* Groceries', '- [ ] Milk', ''].join('\n'))
    expect(edit).not.toHaveBeenCalled()
  })
})
