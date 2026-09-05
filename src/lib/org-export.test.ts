import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { escapeHtml, exportOrgToHtml, siblingHtmlName } from './org'

describe('export Org → HTML (pure, never mutates source)', () => {
  const SAMPLE = readFileSync(new URL('../../data/slice5-smoke.org', import.meta.url), 'utf8')

  it('exports headlines, lists, emphasis, links, tables, and src as pre/code', () => {
    const before = SAMPLE
    const html = exportOrgToHtml(before)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>Slice 5 smoke — export</title>')
    expect(html).toMatch(/<h1>.*Hello Nest.*<\/h1>/)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<a href="https://example.com">link</a>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Item</th>')
    expect(html).toContain('<td>eggs</td>')
    expect(html).toContain('<pre><code class="language-typescript">')
    expect(html).toContain('const greeting')
    expect(html).toContain('Unrelated headline')
    // Embedded CSS present
    expect(html).toContain('<style>')
    expect(html).toContain('background: #f7f6f3')
  })

  it('is a pure function: Org source bytes are unchanged by export', () => {
    const before = SAMPLE
    const snapshot = before
    void exportOrgToHtml(before)
    expect(before).toBe(snapshot)
    expect(before).toContain('#+BEGIN_SRC typescript')
    expect(before).toContain('* Hello Nest')
    // Helper: export never returns or splices Org — only HTML
    const html = exportOrgToHtml(before)
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.includes('#+BEGIN_SRC')).toBe(false)
  })

  it('escapes HTML in text and src bodies', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    const src = `* X\n#+BEGIN_SRC js\nfoo <bar> & "baz"\n#+END_SRC\n`
    const html = exportOrgToHtml(src)
    expect(html).toContain('foo &lt;bar&gt; &amp; &quot;baz&quot;')
    expect(html).not.toContain('foo <bar>')
  })

  it('maps sibling html names without touching .org extension semantics', () => {
    expect(siblingHtmlName('inbox.org')).toBe('inbox.html')
    expect(siblingHtmlName('projects.ORG')).toBe('projects.html')
  })
})
