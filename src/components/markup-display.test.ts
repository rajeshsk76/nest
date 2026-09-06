import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { MarkupText } from './MarkupText'
import { OutlineEditor } from './OutlineEditor'
import { TodayView } from './TodayView'

const TITLE = '*bold* /italic/ [[https://example.com][text]]'
const SOURCE = `* TODO ${TITLE}\n`

vi.mock('../lib/storage', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/storage')>(),
  loadFiles: () => ({ inbox: '* TODO *bold* /italic/ [[https://example.com][text]]\n', projects: '' }),
}))

function expectRendered(html: string) {
  expect(html).toContain('<strong class="org-bold">')
  expect(html).toContain('<em class="org-italic">')
  expect(html).toContain('href="https://example.com"')
  expect(html).not.toContain('*bold*')
  expect(html).not.toContain('/italic/')
  expect(html).not.toContain('[[https://example.com][text]]')
}

function expectRaw(html: string) {
  expect(html).toContain(TITLE)
  expect(html).not.toContain('<strong')
  expect(html).not.toContain('<em ')
  expect(html).not.toContain('href="https://example.com"')
}

describe('B3 markup display', () => {
  it('renders bold, italic and link labels by default', () => {
    expectRendered(renderToStaticMarkup(createElement(MarkupText, { text: TITLE })))
  })

  it('shows exact markup only when raw mode is requested, and renders again when off', () => {
    expectRaw(renderToStaticMarkup(createElement(MarkupText, { text: TITLE, raw: true })))
    expectRendered(renderToStaticMarkup(createElement(MarkupText, { text: TITLE, raw: false })))
  })

  it('escapes HTML in raw mode instead of interpreting it', () => {
    const text = '<img src=x onerror=alert(1)> *bold*'
    const html = renderToStaticMarkup(createElement(MarkupText, { text, raw: true }))
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; *bold*')
    expect(html).not.toContain('<img')
  })

  it('defaults the App to rendered markup with the raw source panel hidden', () => {
    const html = renderToStaticMarkup(createElement(App))
    expectRendered(html)
    expect(html).toContain('aria-pressed="false">Show raw markup</button>')
    expect(html).toContain('Show source')
    expect(html).not.toContain('class="source-editor"')
  })

  it('applies both modes to outline titles without invoking an edit', () => {
    const edit = vi.fn()
    const props = {
      fileId: 'inbox', source: SOURCE,
      onCycleTodo: edit, onRename: edit, onSetPriority: edit, onSetTags: edit,
      onSetScheduled: edit, onSetDeadline: edit, onPromote: edit, onDemote: edit,
      onMove: edit, onInsertHeading: edit, onUpdateTableCell: edit,
      onAddTableRow: edit, onUpdateSrcBody: edit,
    }
    expectRendered(renderToStaticMarkup(createElement(OutlineEditor, props)))
    expectRaw(renderToStaticMarkup(createElement(OutlineEditor, { ...props, rawMarkup: true })))
    expectRendered(renderToStaticMarkup(createElement(OutlineEditor, { ...props, rawMarkup: false })))
    expect(edit).not.toHaveBeenCalled()
    expect(props.source).toBe(SOURCE)
  })

  it('applies the same modes to Today titles without invoking an edit', () => {
    const edit = vi.fn()
    const props = { files: [{ id: 'inbox', source: SOURCE }], onMarkDone: edit, onSetPriority: edit }
    expectRendered(renderToStaticMarkup(createElement(TodayView, props)))
    expectRaw(renderToStaticMarkup(createElement(TodayView, { ...props, rawMarkup: true })))
    expectRendered(renderToStaticMarkup(createElement(TodayView, { ...props, rawMarkup: false })))
    expect(edit).not.toHaveBeenCalled()
    expect(props.files[0]!.source).toBe(SOURCE)
  })
})
