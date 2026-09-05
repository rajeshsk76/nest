import type { Headline, OrgData, OrgNode } from "uniorg"
import {
  RefuseWrite,
  applyEdits,
  parseOrg,
  type Edit,
} from "./org-core"

function findSectionByPath(tree: OrgData, path: number[]): OrgNode | null {
  let current: OrgNode = tree
  for (const index of path) {
    if (!("children" in current) || !Array.isArray(current.children)) return null
    const sections = current.children.filter((c) => c.type === "section")
    const next = sections[index]
    if (!next) return null
    current = next
  }
  return current
}

function headlineAt(section: OrgNode): Headline | null {
  if (!("children" in section) || !Array.isArray(section.children)) return null
  return (section.children.find((c) => c.type === "headline") as Headline | undefined) ?? null
}

function sectionChildren(section: OrgNode): OrgNode[] | null {
  if (!("children" in section) || !Array.isArray(section.children)) return null
  return section.children as OrgNode[]
}

/** Absolute byte span of a section (headline + body + drawers + children). */
function sectionByteSpan(section: OrgNode): { start: number; end: number } {
  const pos = (section as { position?: { start: { offset: number }; end: { offset: number } } }).position
  if (!pos) throw new RefuseWrite('no source position for section')
  return { start: pos.start.offset, end: pos.end.offset }
}

function collectSubtreeHeadlines(
  section: OrgNode,
  out: Array<{ offset: number; level: number }>,
): void {
  const headline = headlineAt(section)
  if (headline?.position) {
    out.push({ offset: headline.position.start.offset, level: headline.level })
  }
  for (const child of sectionChildren(section) ?? []) {
    if (child.type === 'section') collectSubtreeHeadlines(child, out)
  }
}

function siblingSections(source: string, path: number[]): {
  siblings: OrgNode[]
  index: number
} {
  if (path.length === 0) throw new RefuseWrite('empty headline path')
  const tree = parseOrg(source)
  const index = path[path.length - 1]!
  const parentPath = path.slice(0, -1)
  const parent: OrgNode =
    parentPath.length === 0 ? tree : (findSectionByPath(tree, parentPath) as OrgNode)
  if (!parent) throw new RefuseWrite('parent section not found')
  const kids = sectionChildren(parent) ?? ('children' in parent && Array.isArray(parent.children) ? (parent.children as OrgNode[]) : [])
  const siblings = kids.filter((c) => c.type === 'section')
  if (!siblings[index]) throw new RefuseWrite('headline path not found')
  return { siblings, index }
}

/**
 * Demote subtree: add one star to the headline and every descendant.
 * Byte-splice only — body, drawers, and planning are untouched.
 */
export function demoteSubtreeInSource(source: string, path: number[]): string {
  const section = findSectionByPath(parseOrg(source), path)
  if (!section) throw new RefuseWrite('headline path not found')
  const headlines: Array<{ offset: number; level: number }> = []
  collectSubtreeHeadlines(section, headlines)
  if (headlines.length === 0) throw new RefuseWrite('no headlines in subtree')
  const edits: Edit[] = headlines.map((h) => ({
    start: h.offset,
    end: h.offset,
    text: '*',
  }))
  return applyEdits(source, edits)
}

/**
 * Promote subtree: remove one star from the headline and every descendant.
 * Refuses if any headline would drop below level 1.
 */
export function promoteSubtreeInSource(source: string, path: number[]): string {
  const section = findSectionByPath(parseOrg(source), path)
  if (!section) throw new RefuseWrite('headline path not found')
  const headlines: Array<{ offset: number; level: number }> = []
  collectSubtreeHeadlines(section, headlines)
  if (headlines.length === 0) throw new RefuseWrite('no headlines in subtree')
  if (headlines.some((h) => h.level <= 1)) {
    throw new RefuseWrite('cannot promote level-1 headline')
  }
  const edits: Edit[] = headlines.map((h) => ({
    start: h.offset,
    end: h.offset + 1,
    text: '',
  }))
  return applyEdits(source, edits)
}

/**
 * Move a subtree up or down among its siblings. Swaps contiguous section
 * byte spans — drawers/body/children travel with the headline.
 */
export function moveSubtreeInSource(
  source: string,
  path: number[],
  direction: 'up' | 'down',
): string {
  const { siblings, index } = siblingSections(source, path)
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= siblings.length) return source

  const a = siblings[Math.min(index, target)]!
  const b = siblings[Math.max(index, target)]!
  const aSpan = sectionByteSpan(a)
  const bSpan = sectionByteSpan(b)
  if (aSpan.end > bSpan.start) throw new RefuseWrite('overlapping sibling sections')

  const first = source.slice(aSpan.start, aSpan.end)
  const second = source.slice(bSpan.start, bSpan.end)
  // Bytes between adjacent Org sections are normally empty; refuse if not.
  const between = source.slice(aSpan.end, bSpan.start)
  if (between.trim() !== '') {
    throw new RefuseWrite('non-section bytes between siblings')
  }
  // Adjacent swap: [first][between][second] → [second][between][first]
  return applyEdits(source, [
    { start: aSpan.start, end: bSpan.end, text: second + between + first },
  ])
}

/**
 * Insert a new heading at the same level after the current subtree.
 * Does not touch the current headline's body or drawers.
 */
export function insertHeadingInSource(
  source: string,
  path: number[],
  title = 'New heading',
): string {
  if (/[\r\n]/.test(title)) throw new RefuseWrite('title contains a newline')
  const section = findSectionByPath(parseOrg(source), path)
  if (!section) throw new RefuseWrite('headline path not found')
  const headline = headlineAt(section)
  if (!headline) throw new RefuseWrite('no headline at path')
  const span = sectionByteSpan(section)
  const stars = '*'.repeat(headline.level)
  const cleaned = title.trim() || 'New heading'
  const line = `${stars} ${cleaned}\n`
  return applyEdits(source, [{ start: span.end, end: span.end, text: line }])
}
