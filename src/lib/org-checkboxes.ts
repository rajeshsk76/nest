import type { Headline, ListItem, OrgData, OrgNode, StatisticsCookie } from 'uniorg'
import type { Edit, SpliceResult } from './org-core'
import { RefuseWrite, applyEditsTracked, parseOrg } from './org-core'

export type CheckboxState = 'on' | 'off' | 'trans'

export interface OrgChecklistItemView {
  /** Position in document order among items that have a checkbox; the argument to toggleCheckboxInSource. */
  index: number
  headlinePath: number[] | null
  text: string
  checkbox: CheckboxState
  /** This item's own [n/m] or [n%] cookie, if it carries one. */
  cookie: string | null
  /** True when this item's checkbox is derived from its children, not directly toggleable. */
  hasChildren: boolean
}

type ParentRef =
  | { kind: 'root' }
  | { kind: 'headline'; node: Headline }
  | { kind: 'item'; node: ListItem }

interface WalkState {
  items: ListItem[]
  parentOf: Map<ListItem, ParentRef>
  headlinePathOf: Map<ListItem, number[] | null>
  childrenOfItem: Map<ListItem, ListItem[]>
  childrenOfHeadline: Map<Headline, ListItem[]>
  rootChildren: ListItem[]
  cookieOfItem: Map<ListItem, StatisticsCookie>
  cookieOfHeadline: Map<Headline, StatisticsCookie>
}

function findCookie(nodes: OrgNode[]): StatisticsCookie | null {
  for (const n of nodes) {
    if (n.type === 'statistics-cookie') return n as StatisticsCookie
  }
  return null
}

function findItemCookie(item: ListItem): StatisticsCookie | null {
  for (const child of (item.children ?? []) as OrgNode[]) {
    if (child.type === 'paragraph') {
      const kids = (child as { children?: OrgNode[] }).children ?? []
      const found = findCookie(kids)
      if (found) return found
    }
  }
  return null
}

function addChild(state: WalkState, parent: ParentRef, item: ListItem): void {
  if (parent.kind === 'root') {
    state.rootChildren.push(item)
    return
  }
  if (parent.kind === 'headline') {
    const arr = state.childrenOfHeadline.get(parent.node)
    if (arr) arr.push(item)
    else state.childrenOfHeadline.set(parent.node, [item])
    return
  }
  const arr = state.childrenOfItem.get(parent.node)
  if (arr) arr.push(item)
  else state.childrenOfItem.set(parent.node, [item])
}

function childrenOfParent(state: WalkState, parent: ParentRef): ListItem[] {
  if (parent.kind === 'root') return state.rootChildren
  if (parent.kind === 'headline') return state.childrenOfHeadline.get(parent.node) ?? []
  return state.childrenOfItem.get(parent.node) ?? []
}

function cookieOfParent(state: WalkState, parent: ParentRef): StatisticsCookie | null {
  if (parent.kind === 'root') return null
  if (parent.kind === 'headline') return state.cookieOfHeadline.get(parent.node) ?? null
  return state.cookieOfItem.get(parent.node) ?? null
}

/**
 * Walks the parsed tree once, recording for every list-item: its parent
 * (a headline, an enclosing item, or file root), the enclosing headline's
 * path, its direct child items (one nesting level — cookies and checkbox
 * rollup only ever look at direct children, never the whole subtree), and
 * any statistics-cookie it or its enclosing headline owns.
 */
function walk(node: OrgNode, parent: ParentRef, headlinePath: number[] | null, state: WalkState): void {
  if (node.type === 'section') {
    const kids = ('children' in node && Array.isArray(node.children) ? node.children : []) as OrgNode[]
    const headline = kids.find((c) => c.type === 'headline') as Headline | undefined
    const bodyParent: ParentRef = headline ? { kind: 'headline', node: headline } : parent
    if (headline) {
      const cookie = findCookie((headline.children ?? []) as unknown as OrgNode[])
      if (cookie) state.cookieOfHeadline.set(headline, cookie)
    }
    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'headline') continue
      if (child.type === 'section') {
        walk(child, bodyParent, [...(headlinePath ?? []), sectionIndex], state)
        sectionIndex += 1
      } else {
        walk(child, bodyParent, headlinePath, state)
      }
    }
    return
  }

  if (node.type === 'plain-list') {
    for (const item of (node.children ?? []) as ListItem[]) {
      state.items.push(item)
      state.parentOf.set(item, parent)
      state.headlinePathOf.set(item, headlinePath)
      addChild(state, parent, item)
      walk(item, parent, headlinePath, state)
    }
    return
  }

  if (node.type === 'list-item') {
    const item = node as ListItem
    const cookie = findItemCookie(item)
    if (cookie) state.cookieOfItem.set(item, cookie)
    const itemParent: ParentRef = { kind: 'item', node: item }
    for (const child of (item.children ?? []) as OrgNode[]) {
      walk(child, itemParent, headlinePath, state)
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children as OrgNode[]) {
      if (child.type === 'section') {
        walk(child, parent, [...(headlinePath ?? []), sectionIndex], state)
        sectionIndex += 1
      } else {
        walk(child, parent, headlinePath, state)
      }
    }
  }
}

function build(source: string): WalkState {
  const tree = parseOrg(source) as OrgData
  const state: WalkState = {
    items: [],
    parentOf: new Map(),
    headlinePathOf: new Map(),
    childrenOfItem: new Map(),
    childrenOfHeadline: new Map(),
    rootChildren: [],
    cookieOfItem: new Map(),
    cookieOfHeadline: new Map(),
  }
  walk(tree, { kind: 'root' }, null, state)
  return state
}

function flattenText(node: OrgNode): string {
  if (node.type === 'text') return (node as { value: string }).value
  if ('children' in node && Array.isArray((node as { children?: OrgNode[] }).children)) {
    return ((node as { children: OrgNode[] }).children).map(flattenText).join('')
  }
  if ('value' in node && typeof (node as { value: unknown }).value === 'string') {
    return (node as { value: string }).value
  }
  return ''
}

function itemText(item: ListItem): string {
  for (const child of (item.children ?? []) as OrgNode[]) {
    if (child.type === 'paragraph') {
      const kids = (child as { children?: OrgNode[] }).children ?? []
      return kids
        .filter((k) => k.type !== 'statistics-cookie')
        .map(flattenText)
        .join('')
        .trim()
    }
  }
  return ''
}

function hasCheckboxChildren(state: WalkState, item: ListItem): boolean {
  return (state.childrenOfItem.get(item) ?? []).some((c) => c.checkbox !== null)
}

/** Read-only view of every checkbox item in the file, in document order. */
export function listCheckboxes(source: string): OrgChecklistItemView[] {
  const state = build(source)
  const checkboxItems = state.items.filter((i) => i.checkbox !== null)
  return checkboxItems.map((item, index) => {
    const cookie = state.cookieOfItem.get(item)
    return {
      index,
      headlinePath: state.headlinePathOf.get(item) ?? null,
      text: itemText(item),
      checkbox: item.checkbox as CheckboxState,
      cookie: cookie ? cookie.value : null,
      hasChildren: hasCheckboxChildren(state, item),
    }
  })
}

function checkboxSpan(source: string, item: ListItem): { start: number; end: number } {
  if (!item.position) throw new RefuseWrite('no source position for checklist item')
  const bulletEnd = item.position.start.offset + item.bullet.length
  const windowEnd = Math.min(source.length, bulletEnd + 16)
  const m = source.slice(bulletEnd, windowEnd).match(/\[[ Xx-]\]/)
  if (!m || m.index === undefined) throw new RefuseWrite('checkbox marker not found')
  const start = bulletEnd + m.index
  return { start, end: start + 3 }
}

function checkboxChar(state: CheckboxState): string {
  return state === 'on' ? 'X' : state === 'off' ? ' ' : '-'
}

function checkboxEdit(source: string, item: ListItem, state: CheckboxState): Edit | null {
  const span = checkboxSpan(source, item)
  const text = `[${checkboxChar(state)}]`
  if (source.slice(span.start, span.end) === text) return null
  return { start: span.start, end: span.end, text }
}

function cookieEdit(cookie: StatisticsCookie, countOn: number, total: number): Edit | null {
  if (!cookie.position) throw new RefuseWrite('no source position for statistics cookie')
  const isPercent = cookie.value.includes('%')
  const text = isPercent
    ? `[${total > 0 ? Math.round((countOn / total) * 100) : 0}%]`
    : `[${countOn}/${total}]`
  if (text === cookie.value) return null
  return { start: cookie.position.start.offset, end: cookie.position.end.offset, text }
}

/**
 * Aggregate a container's direct checkbox children into one state, applying
 * `override` for the one child whose state just changed (its siblings keep
 * their parsed state — this operation never touches state on a branch it
 * did not descend). `on` when every child is on, `off` when every child is
 * off, `trans` ('-') otherwise. Children without a checkbox don't count.
 */
function aggregate(
  children: ListItem[],
  override: { node: ListItem; state: CheckboxState } | null,
): { state: CheckboxState; countOn: number; total: number } {
  let countOn = 0
  let anyOn = false
  let anyTrans = false
  let total = 0
  for (const child of children) {
    if (child.checkbox === null) continue
    total += 1
    const state = override && override.node === child ? override.state : child.checkbox
    if (state === 'on') {
      countOn += 1
      anyOn = true
    } else if (state === 'trans') {
      anyTrans = true
    }
  }
  let state: CheckboxState
  if (total === 0) state = 'off'
  else if (countOn === total) state = 'on'
  else if (!anyOn && !anyTrans) state = 'off'
  else state = 'trans'
  return { state, countOn, total }
}

/**
 * Toggle one existing [ ]/[X] checkbox by its listCheckboxes index, then
 * walk up recomputing every ancestor's derived checkbox state and
 * statistics cookie — direct children only, per level, exactly matching
 * Emacs's org-toggle-checkbox. A checkbox whose state is derived from its
 * own children (rule 3: a "parent") cannot be toggled directly.
 */
export function toggleCheckboxInSource(source: string, index: number): SpliceResult {
  const state = build(source)
  const checkboxItems = state.items.filter((i) => i.checkbox !== null)
  const target = checkboxItems[index]
  if (!target) throw new RefuseWrite('checkbox index out of range')
  if (hasCheckboxChildren(state, target)) {
    throw new RefuseWrite('cannot toggle a checkbox whose state is derived from its children')
  }
  if (target.checkbox !== 'on' && target.checkbox !== 'off') {
    throw new RefuseWrite('cannot toggle a checkbox in a mixed state')
  }

  const newState: CheckboxState = target.checkbox === 'on' ? 'off' : 'on'
  const edits: Array<Edit | null> = [checkboxEdit(source, target, newState)]

  let parent: ParentRef = state.parentOf.get(target) ?? { kind: 'root' }
  let pending: { node: ListItem; state: CheckboxState } | null = { node: target, state: newState }

  while (parent.kind !== 'root') {
    const children = childrenOfParent(state, parent)
    const agg = aggregate(children, pending)

    if (parent.kind === 'item' && parent.node.checkbox !== null) {
      edits.push(checkboxEdit(source, parent.node, agg.state))
    }

    const cookie = cookieOfParent(state, parent)
    if (cookie) edits.push(cookieEdit(cookie, agg.countOn, agg.total))

    if (parent.kind === 'headline') break
    if (parent.node.checkbox === null) break

    pending = { node: parent.node, state: agg.state }
    parent = state.parentOf.get(parent.node) ?? { kind: 'root' }
  }

  return applyEditsTracked(source, edits)
}
