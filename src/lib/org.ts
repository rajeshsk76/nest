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

/** Keywords from #+TODO: / #+SEQ_TODO: / #+TYP_TODO:, minus the `|` and fast keys. */
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

/** Thrown instead of writing a file Nest is not certain about. */
export class RefuseWrite extends Error {}

export interface Edit {
  start: number
  end: number
  text: string
}

/**
 * The compat badge, in eight lines: every byte outside an edit span is
 * copied through from the original. Nothing is ever regenerated.
 */
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

/** Number of contiguous changed line-regions between two versions (0 or 1 expected). */
/** Zero-edit save: return original bytes unchanged (installer gate). */
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

function sameDay(a: DateParts | null, b: DateParts): boolean {
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

/** Active Org date stamp without time: <YYYY-MM-DD Day> */
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

/** Parse HTML date input (YYYY-MM-DD) into DateParts. */
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

/**
 * Weekday abbreviation for a date, used when splicing the date field of an
 * existing stamp. We never build a whole timestamp from scratch: repeaters,
 * warning periods and times of day live in the original bytes.
 */
function weekdayOf(parts: DateParts): string {
  return WEEKDAYS[new Date(parts.year, parts.month - 1, parts.day).getDay()]!
}

function isoOf(parts: DateParts): string {
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

/** Offsets, relative to the headline slice, of the stars / keyword / priority / title. */
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

interface HeadlineContext {
  section: OrgNode
  start: number
  end: number
  eol: number
  parts: HeadParts
}

/**
 * Locate a headline's byte span. uniorg's headline position ends before the
 * tag padding, so `[start,end)` is exactly `* TODO [#A] title`.
 */
function headlineContext(
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

/** Absorb a length change into the tag padding so org-tags-column stays put. */
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

function spliceHead(source: string, ctx: HeadlineContext, edit: Edit): string {
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

export function updateTitleInSource(
  source: string,
  path: number[],
  title: string,
): string {
  if (/[\r\n]/.test(title)) throw new RefuseWrite('title contains a newline')
  const ctx = headlineContext(source, path, todoKeywordsFrom(source))
  return spliceHead(source, ctx, {
    start: ctx.start + ctx.parts.titleStart,
    end: ctx.end,
    text: title,
  })
}

export function updatePriorityInSource(
  source: string,
  path: number[],
  priority: Priority,
): string {
  const ctx = headlineContext(source, path, todoKeywordsFrom(source))
  const { parts, start } = ctx
  const at = start + (parts.priority ? parts.priority.start : parts.titleStart)
  if (parts.priority && priority) {
    return spliceHead(source, ctx, { start: at, end: start + parts.priority.end, text: `[#${priority}]` })
  }
  if (parts.priority && !priority) {
    return spliceHead(source, ctx, {
      start: at,
      end: start + parts.priority.end + parts.priority.gap,
      text: '',
    })
  }
  if (!parts.priority && priority) {
    return spliceHead(source, ctx, { start: at, end: at, text: `[#${priority}] ` })
  }
  return source
}

export function updateTagsInSource(
  source: string,
  path: number[],
  tags: string[],
): string {
  const ctx = headlineContext(source, path, todoKeywordsFrom(source))
  const tail = source.slice(ctx.end, ctx.eol)
  const m = tail.match(/^([ \t]*)((?::[^\s:]+)+:)?[ \t]*$/)
  if (!m) throw new RefuseWrite('unrecognised tag region')
  const cleaned = normalizeTags(tags)
  const cookie = cleaned.length > 0 ? `:${cleaned.join(':')}:` : ''
  const hadPad = (m[1] ?? '').length
  const pad = cookie ? (hadPad > 1 ? ' '.repeat(hadPad) : ' ') : ''
  return applyEdits(source, [{ start: ctx.end, end: ctx.eol, text: pad + cookie }])
}

function sectionChildren(section: OrgNode): OrgNode[] | null {
  if (!('children' in section) || !Array.isArray(section.children)) return null
  return section.children as OrgNode[]
}

function findPlanning(section: OrgNode): Planning | null {
  const kids = sectionChildren(section)
  if (!kids) return null
  return (kids.find((c) => c.type === 'planning') as Planning | undefined) ?? null
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function setPlanningField(
  source: string,
  path: number[],
  field: 'scheduled' | 'deadline',
  date: DateParts | null,
): string {
  const ctx = headlineContext(source, path, todoKeywordsFrom(source))
  const planning = findPlanning(ctx.section)
  const ts = planning ? planning[field] : null
  const label = field === 'scheduled' ? 'SCHEDULED' : 'DEADLINE'

  // Change a date: splice the date field only. Time of day, repeaters and
  // warning periods sit in the original bytes and are copied through.
  if (date && ts) {
    if (!ts.position) throw new RefuseWrite('no source position for timestamp')
    const start = ts.position.start.offset
    const end = ts.position.end.offset
    const raw = source.slice(start, end)
    const m = raw.match(/^([<[])(\d{4}-\d{2}-\d{2})(?:[ \t]+[^\s>\]]{2,3})?([\s\S]*)([>\]])$/)
    if (!m) throw new RefuseWrite(`unrecognised timestamp: ${raw}`)
    return applyEdits(source, [
      { start, end, text: `${m[1]}${isoOf(date)} ${weekdayOf(date)}${m[3]}${m[4]}` },
    ])
  }

  // Add: extend an existing planning line, or insert one under the headline.
  if (date && !ts) {
    const text = `${label}: <${isoOf(date)} ${weekdayOf(date)}>`
    if (planning?.position) {
      const at = planning.position.end.offset
      return applyEdits(source, [{ start: at, end: at, text: ` ${text}` }])
    }
    return applyEdits(source, [{ start: ctx.eol, end: ctx.eol, text: `\n${text}` }])
  }

  // Clear: drop the keyword and its stamp; drop the line if nothing is left.
  if (!date && ts) {
    if (!planning?.position || !ts.position) throw new RefuseWrite('no source position for planning')
    const pStart = planning.position.start.offset
    const pEnd = planning.position.end.offset
    const raw = source.slice(ts.position.start.offset, ts.position.end.offset)
    const stripped = source
      .slice(pStart, pEnd)
      .replace(new RegExp(`${label}:[ \\t]*${escapeRe(raw)}[ \\t]*`), '')
      .replace(/[ \t]+$/, '')
    if (stripped.trim() === '') {
      const lineEnd = source[pEnd] === '\n' ? pEnd + 1 : pEnd
      return applyEdits(source, [{ start: pStart, end: lineEnd, text: '' }])
    }
    return applyEdits(source, [{ start: pStart, end: pEnd, text: stripped }])
  }

  return source
}

/**
 * Set or clear SCHEDULED on a headline. Pass null to clear.
 * Writes a real Org active timestamp via uniorg stringify.
 */
export function updateScheduledInSource(
  source: string,
  path: number[],
  date: DateParts | null,
): string {
  return setPlanningField(source, path, 'scheduled', date)
}

/**
 * Set or clear DEADLINE on a headline. Pass null to clear.
 */
export function updateDeadlineInSource(
  source: string,
  path: number[],
  date: DateParts | null,
): string {
  return setPlanningField(source, path, 'deadline', date)
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

/**
 * Parse optional Org priority / tags from capture text.
 * Accepts [#A]/#A`,`#A`,`:tag:` / `:tag1:tag2:` (usually at end).
 */
export function parseCaptureTitle(text: string): ParsedCapture {
  let remaining = text.trim()
  let priority: Priority = null
  const tags: string[] = []

  const bracketPriority = remaining.match(/^(?:.*?)\s*\[#([ABC])\]\s*/i)
  const hashPriority = remaining.match(/(?:^|\s)#([ABC])(?=\s|$)/i)

  if (bracketPriority) {
    priority = bracketPriority[1]!.toUpperCase() as 'A' | 'B' | 'C'
    remaining = remaining.replace(/\[#([ABC])\]/i, ' ').replace(/\s+/g, ' ').trim()
  } else if (hashPriority) {
    priority = hashPriority[1]!.toUpperCase() as 'A' | 'B' | 'C'
    remaining = remaining.replace(/(?:^|\s)#([ABC])(?=\s|$)/i, ' ').replace(/\s+/g, ' ').trim()
  }

  // Trailing Org tag cookie: :tag: or :tag1:tag2:
  const tagMatch = remaining.match(/\s(:[A-Za-z0-9_@#%]+(?::[A-Za-z0-9_@#%]+)*:)\s*$/)
  if (tagMatch) {
    const cookie = tagMatch[1]!
    const parts = cookie.split(':').filter(Boolean)
    tags.push(...parts)
    remaining = remaining.slice(0, tagMatch.index).trim()
  }

  return {
    title: remaining || text.trim(),
    priority,
    tags: normalizeTags(tags),
  }
}

/**
 * Append a TODO headline to inbox. Always writes an Emacs-friendly
 * `:PROPERTIES:` / `:CREATED:` / `:END:` drawer (inactive timestamp).
 */
export function captureTodo(
  inboxSource: string,
  text: string,
  options: { now?: Date } = {},
): string {
  const cleaned = text.trim()
  if (!cleaned) return inboxSource

  const parsed = parseCaptureTitle(cleaned)
  const title = parsed.title || cleaned
  const priorityCookie = parsed.priority ? ` [#${parsed.priority}]` : ''
  const tagCookie =
    parsed.tags.length > 0 ? ` :${parsed.tags.join(':')}:` : ''

  const stamp = formatOrgStamp(options.now ?? new Date(), false)
  const lines = [
    `* TODO${priorityCookie} ${title}${tagCookie}`,
    ':PROPERTIES:',
    `:CREATED: ${stamp}`,
    ':END:',
    '',
  ]

  const base = inboxSource.endsWith('\n') ? inboxSource : `${inboxSource}\n`
  return `${base}${lines.join('\n')}`
}

function priorityWeight(priority: Priority): number {
  if (priority === 'A') return 0
  if (priority === 'B') return 1
  if (priority === 'C') return 2
  return 3
}

function sortTodayItems(items: TodayItem[]): TodayItem[] {
  const reasonWeight = { deadline: 0, scheduled: 1, todo: 2 }
  return items.sort(
    (a, b) =>
      priorityWeight(a.priority) - priorityWeight(b.priority) ||
      reasonWeight[a.reason] - reasonWeight[b.reason] ||
      a.title.localeCompare(b.title),
  )
}

export function collectTodayItems(
  files: Array<{ id: string; source: string }>,
  now = new Date(),
): TodayItem[] {
  const today = todayParts(now)
  const items: TodayItem[] = []
  const seen = new Set<string>()

  for (const file of files) {
    for (const h of listHeadlines(file.source, file.id)) {
      if (h.todo === 'DONE') continue

      const reasons: TodayItem['reason'][] = []
      if (sameDay(h.scheduledDate, today)) reasons.push('scheduled')
      if (sameDay(h.deadlineDate, today)) reasons.push('deadline')
      if (h.todo === 'TODO' && reasons.length === 0) {
        reasons.push('todo')
      } else if (h.todo === 'TODO' && reasons.length > 0) {
        // already dated; keep dated reasons only
      } else if (!h.todo && reasons.length > 0) {
        // dated non-todo headlines still show
      } else {
        continue
      }

      for (const reason of reasons) {
        const key = `${h.id}:${reason}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({ ...h, reason })
      }
    }
  }

  return sortTodayItems(items)
}

/** Today view focused on dated items + undated TODOs (single row per headline). */
export function collectTodayAgenda(
  files: Array<{ id: string; source: string }>,
  now = new Date(),
): TodayItem[] {
  const today = todayParts(now)
  const items: TodayItem[] = []

  for (const file of files) {
    for (const h of listHeadlines(file.source, file.id)) {
      if (h.todo === 'DONE') continue

      const isScheduled = sameDay(h.scheduledDate, today)
      const isDeadline = sameDay(h.deadlineDate, today)
      const isOpenTodo = h.todo === 'TODO'

      if (!isScheduled && !isDeadline && !isOpenTodo) continue

      let reason: TodayItem['reason'] = 'todo'
      if (isDeadline) reason = 'deadline'
      else if (isScheduled) reason = 'scheduled'

      items.push({ ...h, reason })
    }
  }

  return sortTodayItems(items)
}

export function emptyTodayFilters(): TodayFilters {
  return { priorities: [], tags: [] }
}

export function filterTodayItems(
  items: TodayItem[],
  filters: TodayFilters,
): TodayItem[] {
  const pri = filters.priorities
  const tags = filters.tags
  if (pri.length === 0 && tags.length === 0) return items

  return items.filter((item) => {
    let okPriority = true
    if (pri.length > 0) {
      const key = item.priority ?? 'none'
      okPriority = pri.includes(key)
    }
    let okTags = true
    if (tags.length > 0) {
      okTags = tags.every((t) => item.tags.includes(t))
    }
    return okPriority && okTags
  })
}

export function collectUniqueTags(
  files: Array<{ id: string; source: string }>,
): string[] {
  const seen = new Set<string>()
  for (const file of files) {
    for (const h of listHeadlines(file.source, file.id)) {
      for (const tag of h.tags) seen.add(tag)
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}
