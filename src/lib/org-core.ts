import type { Headline, OrgData, OrgNode, Planning, Timestamp } from 'uniorg'
import { parse } from 'uniorg-parse/lib/parser.js'
import { stringify } from 'uniorg-stringify/lib/stringify.js'

export type TodoKeyword = 'TODO' | 'DONE' | null
export type Priority = 'A' | 'B' | 'C' | null

export interface HeadlineView {
  id: string
  fileId: string
  level: number
  todo: TodoKeyword
  priority: Priority
  title: string
  tags: string[]
  scheduled: string | null
  deadline: string | null
  scheduledDate: DateParts | null
  deadlineDate: DateParts | null
  path: number[]
}

export interface DateParts {
  year: number
  month: number
  day: number
}

export interface TodayItem extends HeadlineView {
  reason: 'todo' | 'scheduled' | 'deadline'
}

export interface TodayFilters {
  priorities: Array<'A' | 'B' | 'C' | 'none'>
  tags: string[]
}

export interface ParsedCapture {
  title: string
  priority: Priority
  tags: string[]
}

export function todoKeywordsFrom(source: string): string[] {
  const out: string[] = []
  const re = /^[ \t]*#\+(?:TODO|SEQ_TODO|TYP_TODO):(.*)$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    for (const tok of m[1]!.split(/\s+/)) {
      if (!tok || tok === '|') continue
      out.push(tok.replace(/\([^)]*\)$/, ''))
    }
  }
  if (out.length === 0) return ['TODO', 'DONE']
  if (!out.includes('TODO')) out.push('TODO')
  if (!out.includes('DONE')) out.push('DONE')
  return [...new Set(out)]
}

export function parseOrg(source: string): OrgData {
  return parse(source, {
    trackPosition: true,
    todoKeywords: todoKeywordsFrom(source),
  })
}

export class RefuseWrite extends Error {}

export interface Edit {
  start: number
  end: number
  text: string
}

export function applyEdits(source: string, edits: Array<Edit | null>): string {
  const sorted = edits.filter((e): e is Edit => e !== null).sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const e of sorted) {
    if (e.start < cursor) throw new RefuseWrite('overlapping edits')
    if (e.start < 0 || e.end > source.length || e.end < e.start) {
      throw new RefuseWrite('edit span out of range')
    }
    out += source.slice(cursor, e.start) + e.text
    cursor = e.end
  }
  return out + source.slice(cursor)
}

export function zeroEditWrite(source: string): string {
  return source
}

export function changedRegions(before: string, after: string): number {
  const a = before.split('\n')
  const b = after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1
  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1
  }
  return a.length - head - tail === 0 && b.length - head - tail === 0 ? 0 : 1
}

export function stringifyOrg(tree: OrgData | OrgNode): string {
  return stringify(tree)
}

export function roundTrip(source: string): string {
  return stringifyOrg(parseOrg(source))
}

function asTodo(keyword: string | null): TodoKeyword {
  if (keyword === 'TODO' || keyword === 'DONE') return keyword
  return null
}

function asPriority(value: string | null | undefined): Priority {
  if (value === 'A' || value === 'B' || value === 'C') return value
  return null
}

function dateParts(ts: Timestamp | null | undefined): DateParts | null {
  if (!ts?.start) return null
  return {
    year: ts.start.year,
    month: ts.start.month,
    day: ts.start.day,
  }
}

export function sameDay(a: DateParts | null, b: DateParts): boolean {
  return !!a && a.year === b.year && a.month === b.month && a.day === b.day
}

export function todayParts(now = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  }
}

export function formatOrgStamp(d = new Date(), active = false): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const stamp = `${y}-${m}-${day} ${days[d.getDay()]} ${hh}:${mm}`
  return active ? `<${stamp}>` : `[${stamp}]`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function formatOrgDate(parts: DateParts, active = true): string {
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  const stamp = `${y}-${m}-${d} ${WEEKDAYS[date.getDay()]}`
  return active ? `<${stamp}>` : `[${stamp}]`
}

export function datePartsToInput(parts: DateParts | null | undefined): string {
  if (!parts) return ''
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function datePartsFromInput(value: string): DateParts | null {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(year, month - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() + 1 !== month ||
    probe.getDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function weekdayOf(parts: DateParts): string {
  return WEEKDAYS[new Date(parts.year, parts.month - 1, parts.day).getDay()]!
}

export function isoOf(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function planningOf(sectionChildren: OrgNode[]): Planning | null {
  const node = sectionChildren.find((c) => c.type === 'planning')
  return (node as Planning | undefined) ?? null
}

function walkHeadlines(
  node: OrgNode,
  fileId: string,
  path: number[],
  out: HeadlineView[],
): void {
  if (node.type === 'section') {
    const kids = node.children ?? []
    const headline = kids.find((c) => c.type === 'headline') as Headline | undefined
    if (headline) {
      const body = kids.filter((c) => c.type !== 'headline')
      const planning = planningOf(body)
      out.push({
        id: `${fileId}:${path.join('.')}`,
        fileId,
        level: headline.level,
        todo: asTodo(headline.todoKeyword),
        priority: asPriority(headline.priority),
        title: headline.rawValue,
        tags: [...(headline.tags ?? [])],
        scheduled: planning?.scheduled?.rawValue ?? null,
        deadline: planning?.deadline?.rawValue ?? null,
        scheduledDate: dateParts(planning?.scheduled),
        deadlineDate: dateParts(planning?.deadline),
        path: [...path],
      })
    }

    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'section') {
        walkHeadlines(child, fileId, [...path, sectionIndex], out)
        sectionIndex += 1
      }
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children) {
      if (child.type === 'section') {
        walkHeadlines(child, fileId, [...path, sectionIndex], out)
        sectionIndex += 1
      } else {
        walkHeadlines(child as OrgNode, fileId, path, out)
      }
    }
  }
}

export function listHeadlines(source: string, fileId: string): HeadlineView[] {
  const tree = parseOrg(source)
  const out: HeadlineView[] = []
  walkHeadlines(tree, fileId, [], out)
  return out
}

function findSectionByPath(tree: OrgData, path: number[]): OrgNode | null {
  let current: OrgNode = tree
  for (const index of path) {
    if (!('children' in current) || !Array.isArray(current.children)) return null
    const sections = current.children.filter((c) => c.type === 'section')
    const next = sections[index]
    if (!next) return null
    current = next
  }
  return current
}

function headlineAt(section: OrgNode): Headline | null {
  if (!('children' in section) || !Array.isArray(section.children)) return null
  return (section.children.find((c) => c.type === 'headline') as Headline | undefined) ?? null
}

interface HeadSlot {
  start: number
  end: number
  gap: number
}

interface HeadParts {
  starsEnd: number
  keyword: HeadSlot | null
  priority: HeadSlot | null
  titleStart: number
}

function headParts(head: string, keywords: string[]): HeadParts | null {
  const stars = head.match(/^(\*+[ \t]+)/)
  if (!stars) return null
  let i = stars[1]!.length
  const parts: HeadParts = { starsEnd: i, keyword: null, priority: null, titleStart: i }
  const kw = head.slice(i).match(/^(\S+)([ \t]*)/)
  if (kw && keywords.includes(kw[1]!)) {
    parts.keyword = { start: i, end: i + kw[1]!.length, gap: kw[2]!.length }
    i += kw[0]!.length
  }
  const pri = head.slice(i).match(/^(\[#[A-Za-z0-9]\])([ \t]*)/)
  if (pri) {
    parts.priority = { start: i, end: i + pri[1]!.length, gap: pri[2]!.length }
    i += pri[0]!.length
  }
  parts.titleStart = i
  return parts
}

export interface HeadlineContext {
  section: OrgNode
  start: number
  end: number
  eol: number
  parts: HeadParts
}

export function headlineContext(
  source: string,
  path: number[],
  keywords: string[],
): HeadlineContext {
  const section = findSectionByPath(parseOrg(source), path)
  if (!section) throw new RefuseWrite('headline path not found')
  const headline = headlineAt(section)
  if (!headline?.position) throw new RefuseWrite('no source position for headline')
  const start = headline.position.start.offset
  const end = headline.position.end.offset
  const parts = headParts(source.slice(start, end), keywords)
  if (!parts) throw new RefuseWrite('unrecognised headline shape')
  const nl = source.indexOf('\n', end)
  return { section, start, end, eol: nl < 0 ? source.length : nl, parts }
}

function repadTags(source: string, ctx: HeadlineContext, delta: number): Edit | null {
  if (delta === 0) return null
  const tail = source.slice(ctx.end, ctx.eol)
  const m = tail.match(/^([ \t]{2,})(:[^\s:]+(?::[^\s:]+)*:)[ \t]*$/)
  if (!m) return null
  return {
    start: ctx.end,
    end: ctx.end + m[1]!.length,
    text: ' '.repeat(Math.max(1, m[1]!.length - delta)),
  }
}

export function spliceHead(source: string, ctx: HeadlineContext, edit: Edit): string {
  const delta = edit.text.length - (edit.end - edit.start)
  return applyEdits(source, [edit, repadTags(source, ctx, delta)])
}

export function updateTodoInSource(
  source: string,
  path: number[],
  todo: TodoKeyword,
): string {
  const ctx = headlineContext(source, path, todoKeywordsFrom(source))
  const { parts, start } = ctx
  if (parts.keyword && todo) {
    return spliceHead(source, ctx, {
      start: start + parts.keyword.start,
      end: start + parts.keyword.end,
      text: todo,
    })
  }
  if (parts.keyword && !todo) {
    return spliceHead(source, ctx, {
      start: start + parts.keyword.start,
      end: start + parts.keyword.end + parts.keyword.gap,
      text: '',
    })
  }
  if (!parts.keyword && todo) {
    return spliceHead(source, ctx, {
      start: start + parts.starsEnd,
      end: start + parts.starsEnd,
      text: `${todo} `,
    })
  }
  return source
}

export function cycleTodo(todo: TodoKeyword): TodoKeyword {
  if (todo === 'TODO') return 'DONE'
  if (todo === 'DONE') return null
  return 'TODO'
}

export function cyclePriority(priority: Priority): Priority {
  if (priority === 'A') return 'B'
  if (priority === 'B') return 'C'
  if (priority === 'C') return null
  return 'A'
}

export function markDoneInSource(source: string, path: number[]): string {
  return updateTodoInSource(source, path, 'DONE')
}

export function normalizeTag(tag: string): string | null {
  const cleaned = tag.trim().replace(/^:+|:+$/g, '')
  if (!cleaned) return null
  if (!/^[A-Za-z0-9_@#%]+$/.test(cleaned)) return null
  return cleaned
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const n = normalizeTag(tag)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
