import type { OrgNode } from 'uniorg'
import { listHeadlines, normalizeTag, parseOrg } from './org-core'

export interface SearchHit {
  fileId: string
  path: number[]
  title: string
  level: number
  todo: string | null
  priority: string | null
  tags: string[]
  scheduled: string | null
  deadline: string | null
  props: Record<string, string>
  matchedIn: 'title' | 'body'
}

export interface TagQuery {
  require: string[]
  exclude: string[]
  anyOf: string[][]
  props: Array<{ key: string; op: '=' | '<>'; value: string }>
}

function pathKey(path: number[]): string {
  return path.join('.')
}

function isProperPrefix(prefix: number[], path: number[]): boolean {
  if (prefix.length >= path.length) return false
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] !== path[i]) return false
  }
  return true
}

/**
 * Scrapes #+FILETAGS: lines. Unlike #+TAGS:, FILETAGS is a single
 * colon-delimited list (`:work:urgent:`), not space-separated tokens.
 */
function fileTagsFrom(source: string): string[] {
  const out: string[] = []
  const re = /^[ \t]*#\+FILETAGS:(.*)$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    for (const tok of m[1]!.split(':')) {
      const cleaned = normalizeTag(tok)
      if (cleaned) out.push(cleaned)
    }
  }
  return [...new Set(out)]
}

function nodeText(node: OrgNode, source: string): string {
  const pos = (node as { position?: { start: { offset: number }; end: { offset: number } } })
    .position
  if (!pos) return ''
  return source.slice(pos.start.offset, pos.end.offset)
}

interface SectionData {
  body: Map<string, string>
  props: Map<string, Record<string, string>>
}

function propsFromDrawer(kids: OrgNode[]): Record<string, string> {
  const drawer = kids.find((c) => c.type === 'property-drawer') as
    | (OrgNode & { children?: Array<{ type: string; key?: string; value?: string }> })
    | undefined
  if (!drawer?.children) return {}
  const out: Record<string, string> = {}
  for (const p of drawer.children) {
    if (p.type === 'node-property' && p.key) out[p.key] = p.value ?? ''
  }
  return out
}

/**
 * Raw source text of everything under a headline except its title line and
 * nested sub-headlines (those are searched as their own hits), plus each
 * headline's own :PROPERTIES: drawer entries. One walk, keyed by path.
 */
function collectSectionData(node: OrgNode, path: number[], source: string, out: SectionData): void {
  if (node.type === 'section') {
    const kids = ('children' in node && Array.isArray(node.children) ? node.children : []) as OrgNode[]
    const bodyText = kids
      .filter((c) => c.type !== 'headline' && c.type !== 'section')
      .map((c) => nodeText(c, source))
      .filter(Boolean)
      .join('\n')
    out.body.set(pathKey(path), bodyText)
    out.props.set(pathKey(path), propsFromDrawer(kids))

    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'section') {
        collectSectionData(child, [...path, sectionIndex], source, out)
        sectionIndex += 1
      }
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children as OrgNode[]) {
      if (child.type === 'section') {
        collectSectionData(child, [...path, sectionIndex], source, out)
        sectionIndex += 1
      } else {
        collectSectionData(child, path, source, out)
      }
    }
  }
}

/** Case-insensitive substring search over headline titles and bodies. */
export function searchHeadlines(sources: Record<string, string>, query: string): SearchHit[] {
  const needle = query.toLowerCase()
  const hits: SearchHit[] = []

  for (const [fileId, source] of Object.entries(sources)) {
    const headlines = listHeadlines(source, fileId)
    const fileTags = fileTagsFrom(source)
    const sectionData: SectionData = { body: new Map(), props: new Map() }
    collectSectionData(parseOrg(source), [], source, sectionData)

    const ancestors: Array<{ path: number[]; tags: string[] }> = []
    for (const hw of headlines) {
      while (ancestors.length > 0 && !isProperPrefix(ancestors[ancestors.length - 1]!.path, hw.path)) {
        ancestors.pop()
      }

      const inherited = new Set<string>(fileTags)
      for (const anc of ancestors) for (const t of anc.tags) inherited.add(t)
      for (const t of hw.tags) inherited.add(t)
      const tags = [...inherited]

      ancestors.push({ path: hw.path, tags: hw.tags })

      const body = sectionData.body.get(pathKey(hw.path)) ?? ''
      const titleMatch = hw.title.toLowerCase().includes(needle)
      const bodyMatch = !titleMatch && body.toLowerCase().includes(needle)
      if (!titleMatch && !bodyMatch) continue

      hits.push({
        fileId,
        path: hw.path,
        title: hw.title,
        level: hw.level,
        todo: hw.todo,
        priority: hw.priority,
        tags,
        scheduled: hw.scheduled,
        deadline: hw.deadline,
        props: sectionData.props.get(pathKey(hw.path)) ?? {},
        matchedIn: titleMatch ? 'title' : 'body',
      })
    }
  }

  return hits
}

function stripQuotes(raw: string): string {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw.slice(1, -1)
  }
  return raw
}

function tokenizeTagQuery(query: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of query.trim()) {
    if (ch === '"') inQuotes = !inQuotes
    if (!inQuotes && (ch === '+' || ch === '-') && current !== '') {
      tokens.push(current)
      current = ch
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

function applyToken(raw: string, q: TagQuery): void {
  let sign: '' | '+' | '-' = ''
  let body = raw
  if (body[0] === '+' || body[0] === '-') {
    sign = body[0] as '+' | '-'
    body = body.slice(1)
  }
  body = body.trim()
  if (!body) return

  const neIdx = body.indexOf('<>')
  const eqIdx = body.indexOf('=')
  if (neIdx >= 0 && (eqIdx < 0 || neIdx < eqIdx)) {
    q.props.push({
      key: body.slice(0, neIdx).trim(),
      op: '<>',
      value: stripQuotes(body.slice(neIdx + 2).trim()),
    })
    return
  }
  if (eqIdx >= 0) {
    q.props.push({
      key: body.slice(0, eqIdx).trim(),
      op: '=',
      value: stripQuotes(body.slice(eqIdx + 1).trim()),
    })
    return
  }

  if (body.includes('|')) {
    q.anyOf.push(
      body
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean),
    )
    return
  }

  if (sign === '-') q.exclude.push(body)
  else q.require.push(body)
}

/**
 * Parses a tag/property query: `+require-exclude`, `a|b` (any-of group),
 * and `KEY="value"` / `KEY<>"value"` property clauses. Terms concatenate
 * with no separator, each new term starting at a `+` or `-`.
 */
export function parseTagQuery(query: string): TagQuery {
  const q: TagQuery = { require: [], exclude: [], anyOf: [], props: [] }
  for (const token of tokenizeTagQuery(query)) {
    applyToken(token, q)
  }
  return q
}

/**
 * PRIORITY, TODO, ITEM, LEVEL, SCHEDULED, DEADLINE and TAGS are Org's
 * "special properties" — derived from headline structure rather than a
 * :PROPERTIES: drawer entry. Used as the fallback when a property clause's
 * key has no matching entry in the headline's own drawer (see matchesProp).
 */
function specialPropValue(hit: SearchHit, key: string): string | null {
  switch (key.toUpperCase()) {
    case 'TODO':
      return hit.todo
    case 'PRIORITY':
      return hit.priority
    case 'ITEM':
      return hit.title
    case 'LEVEL':
      return String(hit.level)
    case 'SCHEDULED':
      return hit.scheduled
    case 'DEADLINE':
      return hit.deadline
    case 'TAGS':
      return hit.tags.length > 0 ? `:${hit.tags.join(':')}:` : null
    default:
      return null
  }
}

/** Case-insensitive lookup into a headline's :PROPERTIES: drawer. */
function drawerPropValue(props: Record<string, string>, key: string): string | null {
  const target = key.toUpperCase()
  for (const [k, v] of Object.entries(props)) {
    if (k.toUpperCase() === target) return v
  }
  return null
}

function matchesProp(hit: SearchHit, prop: TagQuery['props'][number]): boolean {
  const actual = drawerPropValue(hit.props, prop.key) ?? specialPropValue(hit, prop.key)
  const equal = actual !== null && actual === prop.value
  return prop.op === '=' ? equal : !equal
}

export function filterHeadlines(hits: SearchHit[], q: TagQuery): SearchHit[] {
  return hits.filter((hit) => {
    for (const tag of q.require) if (!hit.tags.includes(tag)) return false
    for (const tag of q.exclude) if (hit.tags.includes(tag)) return false
    for (const group of q.anyOf) if (!group.some((t) => hit.tags.includes(t))) return false
    for (const prop of q.props) if (!matchesProp(hit, prop)) return false
    return true
  })
}
