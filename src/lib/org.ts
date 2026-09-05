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

function setHeadlineTodo(section: OrgNode, todo: TodoKeyword): void {
  const headline = headlineAt(section)
  if (!headline) return
  headline.todoKeyword = todo
}

export function updateTodoInSource(
  source: string,
  path: number[],
  todo: TodoKeyword,
): string {
  const tree = parseOrg(source)
  const section = findSectionByPath(tree, path)
  if (!section) return source
  setHeadlineTodo(section, todo)
  return stringifyOrg(tree)
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
 * Accepts [#A]/#A]/:tag:` / `:tag1:tag2:` (usually at end).
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

export function captureTodo(
  inboxSource: string,
  text: string,
  options: { withTimestamp?: boolean; now?: Date } = {},
): string {
  const cleaned = text.trim()
  if (!cleaned) return inboxSource

  const parsed = parseCaptureTitle(cleaned)
  const title = parsed.title || cleaned
  const priorityCookie = parsed.priority ? ` [#${parsed.priority}]` : ''
  const tagCookie =
    parsed.tags.length > 0 ? ` :${parsed.tags.join(':')}:` : ''

  const lines = [`* TODO${priorityCookie} ${title}${tagCookie}`]
  if (options.withTimestamp !== false) {
    const stamp = formatOrgStamp(options.now ?? new Date(), false)
    lines.push(':PROPERTIES:')
    lines.push(`:CREATED: ${stamp}`)
    lines.push(':END:')
  }
  lines.push('')

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
