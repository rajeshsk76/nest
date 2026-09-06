import type { OrgData, OrgNode } from 'uniorg'
import { RefuseWrite, parseOrg, startupOptionsFrom } from './org-core'

export type DrawerKind = 'properties' | 'logbook'

export interface OrgDrawerView {
  /** 0-based index among tracked drawers (:PROPERTIES: and :LOGBOOK:) in the file */
  index: number
  kind: DrawerKind
  start: number
  end: number
  /** Section path of the containing headline, or null at file root */
  headlinePath: number[] | null
  /** Raw source text of the drawer, opening line through :END: */
  raw: string
}

function drawerKind(node: OrgNode): DrawerKind | null {
  if (node.type === 'property-drawer') return 'properties'
  if (node.type === 'drawer' && (node as { name?: string }).name?.toUpperCase() === 'LOGBOOK') {
    return 'logbook'
  }
  return null
}

function walkDrawers(
  node: OrgNode,
  headlinePath: number[] | null,
  source: string,
  out: Array<Omit<OrgDrawerView, 'index'>>,
): void {
  const kind = drawerKind(node)
  if (kind) {
    const pos = (node as { position?: { start: { offset: number }; end: { offset: number } } })
      .position
    if (!pos) throw new RefuseWrite('no source position for drawer')
    out.push({
      kind,
      start: pos.start.offset,
      end: pos.end.offset,
      headlinePath: headlinePath ? [...headlinePath] : null,
      raw: source.slice(pos.start.offset, pos.end.offset),
    })
    return
  }

  if (node.type === 'section') {
    const kids = ('children' in node && Array.isArray(node.children) ? node.children : []) as OrgNode[]
    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'section') {
        const childPath = [...(headlinePath ?? []), sectionIndex]
        walkDrawers(child, childPath, source, out)
        sectionIndex += 1
      } else {
        walkDrawers(child, headlinePath, source, out)
      }
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children as OrgNode[]) {
      if (child.type === 'section') {
        walkDrawers(child, [sectionIndex], source, out)
        sectionIndex += 1
      } else {
        walkDrawers(child as OrgNode, headlinePath, source, out)
      }
    }
  }
}

/** List :PROPERTIES: and :LOGBOOK: drawers with absolute byte spans. Display only. */
export function listDrawers(source: string): OrgDrawerView[] {
  const tree = parseOrg(source) as OrgData
  const raw: Array<Omit<OrgDrawerView, 'index'>> = []
  walkDrawers(tree, null, source, raw)
  return raw.map((d, index) => ({ ...d, index }))
}

/**
 * :PROPERTIES: and :LOGBOOK: drawers are machine bookkeeping, not something
 * the person Nest is built for needs to see. They start collapsed, matching
 * Emacs at the `overview` and `content` startup visibility levels (and the
 * no-#+STARTUP-line default); only `showall` — this app's "show everything"
 * level — starts them open.
 */
export function drawersExpandedByDefault(source: string): boolean {
  return startupOptionsFrom(source).visibility === 'showall'
}
