import type { OrgData, OrgNode } from 'uniorg'
import { parseOrg } from './org-core'

export interface ExportOrgOptions {
  /** Document <title>; overrides #+TITLE when set */
  title?: string
}

/** Escape text for HTML element / attribute content. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;')
}

function keywordTitle(tree: OrgData): string | null {
  for (const child of tree.children ?? []) {
    if (child.type === 'keyword') {
      const kw = child as { key?: string; value?: string }
      if ((kw.key ?? '').toUpperCase() === 'TITLE' && kw.value?.trim()) {
        return kw.value.trim()
      }
    }
  }
  return null
}

function renderInline(nodes: OrgNode[]): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += escapeHtml((node as { value: string }).value)
        break
      case 'bold':
        out += `<strong>${renderInline(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])}</strong>`
        break
      case 'italic':
        out += `<em>${renderInline(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])}</em>`
        break
      case 'underline':
        out += `<u>${renderInline(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])}</u>`
        break
      case 'strike-through':
        out += `<s>${renderInline(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])}</s>`
        break
      case 'code':
        out += `<code>${escapeHtml((node as { value: string }).value)}</code>`
        break
      case 'verbatim':
        out += `<code>${escapeHtml((node as { value: string }).value)}</code>`
        break
      case 'link': {
        const link = node as { rawLink: string; children?: OrgNode[] }
        const kids = (link.children ?? []) as OrgNode[]
        const label = kids.length > 0 ? renderInline(kids) : escapeHtml(link.rawLink)
        out += `<a href="${escapeAttr(link.rawLink)}">${label}</a>`
        break
      }
      default: {
        if ('value' in node && typeof (node as { value: unknown }).value === 'string') {
          out += escapeHtml((node as { value: string }).value)
        } else if ('children' in node && Array.isArray((node as { children: unknown }).children)) {
          out += renderInline((node as { children: OrgNode[] }).children)
        }
      }
    }
  }
  return out
}

function flattenPlain(nodes: OrgNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') out += (node as { value: string }).value
    else if ('children' in node && Array.isArray((node as { children: OrgNode[] }).children)) {
      out += flattenPlain((node as { children: OrgNode[] }).children)
    } else if ('value' in node && typeof (node as { value: unknown }).value === 'string') {
      out += (node as { value: string }).value
    }
  }
  return out
}

function renderHeadline(node: OrgNode): string {
  const h = node as {
    level: number
    todoKeyword?: string | null
    priority?: string | null
    tags?: string[]
    children?: OrgNode[]
  }
  const level = Math.min(6, Math.max(1, h.level || 1))
  const parts: string[] = []
  if (h.todoKeyword) {
    const cls = h.todoKeyword === 'DONE' ? 'todo done' : 'todo'
    parts.push(`<span class="${cls}">${escapeHtml(h.todoKeyword)}</span>`)
  }
  if (h.priority) {
    parts.push(`<span class="priority">[#${escapeHtml(h.priority)}]</span>`)
  }
  parts.push(renderInline((h.children ?? []) as OrgNode[]))
  if (h.tags?.length) {
    parts.push(
      `<span class="tags">${h.tags.map((t) => `<span class="tag">:${escapeHtml(t)}:</span>`).join('')}</span>`,
    )
  }
  return `<h${level}>${parts.join(' ')}</h${level}>\n`
}

function renderTable(node: OrgNode): string {
  const rows = ((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]
  const ruleIdx = rows.findIndex((r) => (r as { rowType?: string }).rowType === 'rule')
  let html = '<table>\n'
  rows.forEach((row, i) => {
    const r = row as { rowType?: string; children?: OrgNode[] }
    if (r.rowType === 'rule') return
    const cellTag = ruleIdx > 0 && i < ruleIdx ? 'th' : 'td'
    const cells = (r.children ?? []).filter((c) => c.type === 'table-cell')
    html += '  <tr>'
    for (const cell of cells) {
      const kids = ((cell as { children?: OrgNode[] }).children ?? []) as OrgNode[]
      html += `<${cellTag}>${renderInline(kids)}</${cellTag}>`
    }
    html += '</tr>\n'
  })
  html += '</table>\n'
  return html
}

function renderList(node: OrgNode): string {
  const list = node as { listType?: string; children?: OrgNode[] }
  const tag = list.listType === 'ordered' ? 'ol' : 'ul'
  let html = `<${tag}>\n`
  for (const item of (list.children ?? []) as OrgNode[]) {
    if (item.type !== 'list-item') continue
    const kids = ((item as { children?: OrgNode[] }).children ?? []) as OrgNode[]
    html += `  <li>${renderNodes(kids)}</li>\n`
  }
  html += `</${tag}>\n`
  return html
}

function renderSrc(node: OrgNode): string {
  const block = node as { language?: string | null; value?: string }
  const lang = (block.language ?? '').trim() || 'src'
  const body = block.value ?? ''
  return `<pre><code class="${escapeAttr(`language-${lang}`)}">${escapeHtml(body)}</code></pre>\n`
}

function renderParagraph(node: OrgNode): string {
  const kids = ((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]
  const inner = renderInline(kids).replace(/\n+$/, '')
  if (!inner.trim()) return ''
  return `<p>${inner}</p>\n`
}

function renderNodes(nodes: OrgNode[]): string {
  let out = ''
  for (const node of nodes) out += renderNode(node)
  return out
}

function renderNode(node: OrgNode): string {
  switch (node.type) {
    case 'org-data':
      return renderNodes(((node as OrgData).children ?? []) as OrgNode[])
    case 'section':
      return renderNodes(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])
    case 'headline':
      return renderHeadline(node)
    case 'paragraph':
      return renderParagraph(node)
    case 'plain-list':
      return renderList(node)
    case 'list-item':
      return renderNodes(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])
    case 'table':
      return renderTable(node)
    case 'src-block':
      return renderSrc(node)
    case 'quote-block': {
      const kids = ((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]
      return `<blockquote>${renderNodes(kids)}</blockquote>\n`
    }
    case 'example-block':
    case 'export-block':
    case 'verse-block': {
      const value =
        (node as { value?: string }).value ??
        flattenPlain(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[])
      return `<pre>${escapeHtml(value)}</pre>\n`
    }
    case 'horizontal-rule':
      return '<hr />\n'
    case 'keyword':
    case 'planning':
    case 'property-drawer':
    case 'drawer':
    case 'comment':
    case 'comment-block':
    case 'footnote-definition':
      return ''
    default: {
      if ('children' in node && Array.isArray((node as { children: unknown }).children)) {
        return renderNodes((node as { children: OrgNode[] }).children)
      }
      return ''
    }
  }
}

const EXPORT_CSS = `/* Nest export — calm, self-contained */
:root { color-scheme: light dark; }
body {
  margin: 0;
  padding: 2rem 1.25rem 3rem;
  max-width: 42rem;
  margin-inline: auto;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.55;
  background: #f7f6f3;
  color: #1c1b19;
}
@media (prefers-color-scheme: dark) {
  body { background: #161513; color: #eceae4; }
  a { color: #9ec5b0; }
  pre, code { background: #1e1d1b; }
  table { border-color: #3a3834; }
  th, td { border-color: #3a3834; }
  th { background: #1e1d1b; }
}
h1, h2, h3, h4, h5, h6 {
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 1.6rem 0 0.6rem;
}
h1 { font-size: 1.55rem; }
h2 { font-size: 1.3rem; }
h3 { font-size: 1.15rem; }
p { margin: 0.65rem 0; }
a { color: #2d6a4f; text-decoration: none; }
a:hover { text-decoration: underline; }
ul, ol { margin: 0.65rem 0; padding-left: 1.4rem; }
li { margin: 0.2rem 0; }
li > p { margin: 0.15rem 0; }
strong { font-weight: 650; }
code {
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: #eceae4;
  padding: 0.1em 0.35em;
  border-radius: 0.3em;
}
pre {
  background: #eceae4;
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-size: 0.9rem;
}
pre code { background: transparent; padding: 0; }
table {
  border-collapse: collapse;
  margin: 0.85rem 0;
  width: 100%;
  font-size: 0.95rem;
}
th, td {
  border: 1px solid #d8d4cb;
  padding: 0.4rem 0.65rem;
  text-align: left;
}
th { background: #eceae4; font-weight: 600; }
.todo { font-family: ui-monospace, monospace; font-size: 0.85em; color: #8a5a2b; font-weight: 600; }
.todo.done { color: #4a5d4e; }
.priority { font-family: ui-monospace, monospace; font-size: 0.85em; color: #6f6c66; }
.tags { font-family: ui-monospace, monospace; font-size: 0.8em; color: #6f6c66; }
.tag { margin-left: 0.15rem; }
blockquote {
  margin: 0.85rem 0;
  padding: 0.25rem 0 0.25rem 1rem;
  border-left: 3px solid #c9c4b8;
  color: #4a4844;
}
hr { border: none; border-top: 1px solid #d8d4cb; margin: 1.5rem 0; }
`

/**
 * Pure Org → single-file HTML export.
 * Never mutates or returns the Org source; caller writes a sibling .html only.
 */
export function exportOrgToHtml(source: string, opts?: ExportOrgOptions): string {
  const tree = parseOrg(source) as OrgData
  const title = (opts?.title?.trim() || keywordTitle(tree) || 'Nest export').trim()
  const body = renderNode(tree).trim()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
${EXPORT_CSS}
  </style>
</head>
<body>
${body}
</body>
</html>
`
}

/** Basename for sibling HTML: inbox.org → inbox.html */
export function siblingHtmlName(orgFileName: string): string {
  return orgFileName.replace(/\.org$/i, '') + '.html'
}
