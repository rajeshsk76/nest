import type { OrgNode } from "uniorg"
import { parseOrg } from "./org-core"

/** Inline Org markup for outline display (disk stays raw). */
export type InlineMarkup =
  | { kind: 'text'; value: string }
  | { kind: 'bold' | 'italic' | 'underline' | 'strike'; children: InlineMarkup[] }
  | { kind: 'code' | 'verbatim'; value: string }
  | { kind: 'link'; url: string; label: string }

function flattenMarkup(nodes: InlineMarkup[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case 'text':
        case 'code':
        case 'verbatim':
          return n.value
        case 'link':
          return n.label
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strike':
          return flattenMarkup(n.children)
      }
    })
    .join('')
}

function orgNodesToMarkup(nodes: OrgNode[]): InlineMarkup[] {
  const out: InlineMarkup[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out.push({ kind: 'text', value: (node as { value: string }).value })
        break
      case 'bold':
        out.push({
          kind: 'bold',
          children: orgNodesToMarkup(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]),
        })
        break
      case 'italic':
        out.push({
          kind: 'italic',
          children: orgNodesToMarkup(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]),
        })
        break
      case 'underline':
        out.push({
          kind: 'underline',
          children: orgNodesToMarkup(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]),
        })
        break
      case 'strike-through':
        out.push({
          kind: 'strike',
          children: orgNodesToMarkup(((node as { children?: OrgNode[] }).children ?? []) as OrgNode[]),
        })
        break
      case 'code':
        out.push({ kind: 'code', value: (node as { value: string }).value })
        break
      case 'verbatim':
        out.push({ kind: 'verbatim', value: (node as { value: string }).value })
        break
      case 'link': {
        const link = node as { rawLink: string; children?: OrgNode[] }
        const kids = orgNodesToMarkup((link.children ?? []) as OrgNode[])
        const label = kids.length > 0 ? flattenMarkup(kids) : link.rawLink
        out.push({ kind: 'link', url: link.rawLink, label })
        break
      }
      default: {
        if ('value' in node && typeof (node as { value: unknown }).value === 'string') {
          out.push({ kind: 'text', value: (node as { value: string }).value })
        } else if ('children' in node && Array.isArray((node as { children: unknown }).children)) {
          out.push(...orgNodesToMarkup((node as { children: OrgNode[] }).children))
        }
      }
    }
  }
  return out
}

/**
 * Parse Org inline emphasis and links for display only.
 * Does not mutate source bytes; markers stay in the file / source panel.
 */
export function parseInlineMarkup(text: string): InlineMarkup[] {
  if (!text) return []
  if (/[\r\n]/.test(text)) {
    return [{ kind: 'text', value: text }]
  }
  // Parse as a paragraph so leading TODO / [#A] in title text is not re-tokenized.
  const tree = parseOrg(text + '\n')
  const paragraph = tree.children?.find((c) => c.type === 'paragraph') as
    | { children?: OrgNode[] }
    | undefined
  if (!paragraph?.children?.length) return [{ kind: 'text', value: text }]
  const nodes = orgNodesToMarkup(paragraph.children)
  const last = nodes[nodes.length - 1]
  if (last?.kind === 'text' && last.value.endsWith('\n')) {
    last.value = last.value.replace(/\n$/, '')
    if (last.value === '' && nodes.length > 1) nodes.pop()
  }
  return nodes
}
