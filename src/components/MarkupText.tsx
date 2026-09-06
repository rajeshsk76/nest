import type { ReactNode } from 'react'
import { parseInlineMarkup, type InlineMarkup } from '../lib/org'

function renderNodes(nodes: InlineMarkup[], keyPrefix = 'm'): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`
    switch (node.kind) {
      case 'text':
        return <span key={key}>{node.value}</span>
      case 'bold':
        return (
          <strong key={key} className="org-bold">
            {renderNodes(node.children, key)}
          </strong>
        )
      case 'italic':
        return (
          <em key={key} className="org-italic">
            {renderNodes(node.children, key)}
          </em>
        )
      case 'underline':
        return (
          <span key={key} className="org-underline">
            {renderNodes(node.children, key)}
          </span>
        )
      case 'strike':
        return (
          <s key={key} className="org-strike">
            {renderNodes(node.children, key)}
          </s>
        )
      case 'code':
        return (
          <code key={key} className="org-code">
            {node.value}
          </code>
        )
      case 'verbatim':
        return (
          <code key={key} className="org-verbatim">
            {node.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={key}
            className="org-link"
            href={node.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            {node.label}
          </a>
        )
      default:
        return null
    }
  })
}

/** Display-only Org inline markup. Source bytes stay raw in the file / source panel. */
export function MarkupText({ text, raw = false }: { text: string; raw?: boolean }) {
  if (raw) return <span className="markup-text">{text}</span>
  const nodes = parseInlineMarkup(text)
  return <span className="markup-text">{renderNodes(nodes)}</span>
}
