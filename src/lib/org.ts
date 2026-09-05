import type { Headline, OrgData, OrgNode, Planning, Text, Timestamp } from 'uniorg'
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

export function parseOrg(source: string): OrgData {
  return parse(source)
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

export function makeActiveTimestamp(parts: DateParts): Timestamp {
  return {
    type: 'timestamp',
    timestampType: 'active',
    rawValue: formatOrgDate(parts, true),
    start: {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: null,
      minute: null,
    },
    end: null,
  }
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

export type OrgWriteResult =
  | { ok: true; source: string }
  | { ok: false; reason: string }

/**
 * Zero-edit save: return original bytes unchanged.
 * Installer gate: ≥95% of corpus must stay byte-identical on this path.
 */
export function zeroEditWrite(source: string): string {
  return source
}

/**
 * Locate the TODO/DONE keyword span using the structural prefix before the
 * headline title (`section.contentsBegin` .. `headline.contentsBegin`).
 * Returns absolute [start, end) offsets in `source`, or null if unsure.
 */
function findTodoKeywordSpan(
  source: string,
  section: OrgNode,
  headline: Headline,
  expected: TodoKeyword,
):
  | { start: number; end: number; keyword: 'TODO' | 'DONE' }
  | { start: number; end: number; keyword: null }
  | null {
  const sectionBegin = (section as { contentsBegin?: unknown }).contentsBegin
  const titleBegin = headline.contentsBegin
  if (typeof sectionBegin !== 'number' || typeof titleBegin !== 'number') return null
  if (sectionBegin < 0 || titleBegin < sectionBegin || titleBegin > source.length) {
    return null
  }

  const prefix = source.slice(sectionBegin, titleBegin)
  // Structural prefix only — title text (which may literally say "TODO") is excluded.
  const match = prefix.match(
    /^(\*+)(\s+)(COMMENT\s+)?(TODO|DONE)?(\s*\[#[ABC]\])?(\s*)$/,
  )
  if (!match) return null

  const stars = match[1]!
  const gap = match[2]!
  const comment = match[3] ?? ''
  const keyword = (match[4] as 'TODO' | 'DONE' | undefined) ?? null

  if (keyword !== expected) return null

  if (keyword) {
    const localStart = stars.length + gap.length + comment.length
    return {
      start: sectionBegin + localStart,
      end: sectionBegin + localStart + keyword.length,
      keyword,
    }
  }

  // Insertion point: after stars + gap + optional COMMENT (before priority/title).
  const insertAt = sectionBegin + stars.length + gap.length + comment.length
  return { start: insertAt, end: insertAt, keyword: null }
}

/**
 * Byte-splice only the TODO/DONE token (or insert/remove it).
 * Refuses (ok:false) when the span cannot be verified — never falls back to
 * full-file uniorg-stringify.
 */
export function updateTodoInSource(
  source: string,
  path: number[],
  todo: TodoKeyword,
): OrgWriteResult {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) {
    return { ok: false, reason: `No section at path [${path.join(', ')}]` }
  }
  const headline = headlineAt(section)
  if (!headline) {
    return { ok: false, reason: `No headline at path [${path.join(', ')}]` }
  }

  const current = asTodo(headline.todoKeyword)
  if (current === todo) {
    return { ok: true, source } // zero-edit identity
  }

  const span = findTodoKeywordSpan(source, section, headline, current)
  if (!span) {
    return {
      ok: false,
      reason: `Unsure of TODO keyword span at path [${path.join(', ')}] (refuse splice)`,
    }
  }

  // Double-check line keyword matches AST before mutating bytes.
  if (span.keyword !== current) {
    return {
      ok: false,
      reason: `AST todo (${current}) does not match line keyword (${span.keyword})`,
    }
  }

  let nextSource: string
  if (todo === null) {
    // Remove keyword and one following space if present.
    if (!span.keyword) {
      return { ok: true, source }
    }
    let end = span.end
    if (source[end] === ' ') end += 1
    nextSource = source.slice(0, span.start) + source.slice(end)
  } else if (span.keyword) {
    // Replace TODO ↔ DONE in place (same length).
    nextSource = source.slice(0, span.start) + todo + source.slice(span.end)
  } else {
    // Insert "TODO "/"DONE " at the keyword position.
    nextSource = source.slice(0, span.start) + `${todo} ` + source.slice(span.end)
  }

  // Sanity: re-parse and confirm the target headline now has the desired todo.
  const verify = parseOrg(nextSource)
  const verifySection = findSectionByPath(verify, path)
  const verifyHeadline = verifySection ? headlineAt(verifySection) : null
  if (!verifyHeadline || asTodo(verifyHeadline.todoKeyword) !== todo) {
    return {
      ok: false,
      reason: `Splice verification failed for path [${path.join(', ')}]`,
    }
  }

  return { ok: true, source: nextSource }
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

export function markDoneInSource(source: string, path: number[]): OrgWriteResult {
  return updateTodoInSource(source, path, 'DONE')
}

export function updateTitleInSource(
  source: string,
  path: number[],
  title: string,
): string {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) return source
  const headline = headlineAt(section)
  if (!headline) return source
  headline.rawValue = title
  const textNode: Text = { type: 'text', value: title }
  headline.children = [textNode]
  return stringifyOrg(tree)
}

export function updatePriorityInSource(
  source: string,
  path: number[],
  priority: Priority,
): string {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) return source
  const headline = headlineAt(section)
  if (!headline) return source
  headline.priority = priority
  return stringifyOrg(tree)
}

export function updateTagsInSource(
  source: string,
  path: number[],
  tags: string[],
): string {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) return source
  const headline = headlineAt(section)
  if (!headline) return source
  const cleaned = normalizeTags(tags)
  headline.tags = cleaned
  return stringifyOrg(tree)
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

function ensurePlanning(section: OrgNode): Planning {
  const kids = sectionChildren(section)
  if (!kids) throw new Error('section has no children')
  const existing = findPlanning(section)
  if (existing) return existing

  const planning: Planning = {
    type: 'planning',
    closed: null,
    deadline: null,
    scheduled: null,
  }
  const headlineIndex = kids.findIndex((c) => c.type === 'headline')
  const insertAt = headlineIndex >= 0 ? headlineIndex + 1 : 0
  kids.splice(insertAt, 0, planning)
  return planning
}

function prunePlanningIfEmpty(section: OrgNode): void {
  const kids = sectionChildren(section)
  if (!kids) return
  const index = kids.findIndex((c) => c.type === 'planning')
  if (index < 0) return
  const planning = kids[index] as Planning
  if (planning.scheduled || planning.deadline || planning.closed) return
  kids.splice(index, 1)
}

function setPlanningField(
  source: string,
  path: number[],
  field: 'scheduled' | 'deadline',
  date: DateParts | null,
): string {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) return source
  if (date) {
    const planning = ensurePlanning(section)
    planning[field] = makeActiveTimestamp(date)
  } else {
    const planning = findPlanning(section)
    if (planning) planning[field] = null
    prunePlanningIfEmpty(section)
  }
  return stringifyOrg(tree)
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
