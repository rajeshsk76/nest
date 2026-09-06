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

/**
 * Scrapes #+TAGS: lines for declared tag names.
 * Handles fast-access keys (`home(h)` -> `home`) and mutually exclusive
 * groups wrapped in `{ }` (the braces are stripped, tags inside still count).
 */
export function tagsFrom(source: string): string[] {
  const out: string[] = []
  const re = /^[ \t]*#\+TAGS:(.*)$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    for (const tok of m[1]!.split(/\s+/)) {
      const stripped = tok.replace(/[{}]/g, '').replace(/\([^)]*\)$/, '')
      const cleaned = normalizeTag(stripped)
      if (!cleaned) continue
      out.push(cleaned)
    }
  }
  return [...new Set(out)]
}

export interface StartupOptions {
  visibility: 'overview' | 'content' | 'showall' | null
  logDone: boolean | null
  logRepeat: boolean | null
}

const STARTUP_VISIBILITY = new Set(['overview', 'content', 'showall'])

/**
 * Scrapes #+STARTUP: lines for the visibility and logging keywords Emacs
 * recognizes (org-element.el). Later lines override earlier ones, matching
 * Org's own last-keyword-wins semantics for conflicting settings.
 */
export function startupOptionsFrom(source: string): StartupOptions {
  const out: StartupOptions = { visibility: null, logDone: null, logRepeat: null }
  const re = /^[ \t]*#\+STARTUP:(.*)$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    for (const tokRaw of m[1]!.split(/\s+/)) {
      const tok = tokRaw.toLowerCase()
      if (!tok) continue
      if (STARTUP_VISIBILITY.has(tok)) {
        out.visibility = tok as StartupOptions['visibility']
      } else if (tok === 'logdone') {
        out.logDone = true
      } else if (tok === 'nologdone') {
        out.logDone = false
      } else if (tok === 'logrepeat') {
        out.logRepeat = true
      } else if (tok === 'nologrepeat') {
        out.logRepeat = false
      }
    }
  }
  return out
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

/** Count discrete changed line-hunks between two strings (0 if identical). */
export function changedRegions(before: string, after: string): number {
  if (before === after) return 0
  const a = before.split('\n')
  const b = after.split('\n')
  let regions = 0
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    regions += 1
    const sync = findLineSync(a, i, b, j)
    if (!sync) break
    i = sync.i
    j = sync.j
  }
  return regions
}

/** Next (i, j) where a[i] === b[j] after a change hunk, or null if the rest is one hunk. */
function findLineSync(
  a: string[],
  i: number,
  b: string[],
  j: number,
): { i: number; j: number } | null {
  const aRemain = a.length - i
  const bRemain = b.length - j
  if (aRemain === 0 && bRemain === 0) return null
  const limit = aRemain + bRemain
  for (let span = 1; span <= limit; span += 1) {
    for (let di = 0; di <= span; di += 1) {
      const dj = span - di
      if (i + di >= a.length && j + dj >= b.length) return null
      if (i + di < a.length && j + dj < b.length && a[i + di] === b[j + dj]) {
        return { i: i + di, j: j + dj }
      }
    }
  }
  return null
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

export function todoStateLists(source: string): { todo: string[]; done: string[] } {
  const re = /^[ \t]*#\+(?:TODO|SEQ_TODO|TYP_TODO):(.*)$/im
  const m = source.match(re)
  const parse = (s: string | undefined) =>
    (s ?? '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.replace(/\([^)]*\)$/, ''))
  if (!m) return { todo: ['TODO'], done: ['DONE'] }
  const parts = m[1]!.split('|')
  const todo = parse(parts[0])
  const done = parse(parts[1])
  return {
    todo: todo.length > 0 ? todo : ['TODO'],
    done: done.length > 0 ? done : ['DONE'],
  }
}

export function firstTodoState(source: string): string {
  return todoStateLists(source).todo[0]!
}

const REPEATER_RE = /([.+])?\+(\d+)([hdwmy])/

export function stampHasRepeater(raw: string | null | undefined): boolean {
  return !!raw && REPEATER_RE.test(raw)
}

interface StampDate {
  year: number
  month: number
  day: number
  hour: number | null
  minute: number | null
}

function compareDay(a: StampDate, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

function addDays(parts: StampDate, n: number): StampDate {
  const d = new Date(parts.year, parts.month - 1, parts.day + n)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: parts.hour,
    minute: parts.minute,
  }
}

function addMonths(parts: StampDate, n: number): StampDate {
  let y = parts.year
  let m = parts.month - 1 + n
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  const lastDay = new Date(y, m + 1, 0).getDate()
  return {
    year: y,
    month: m + 1,
    day: Math.min(parts.day, lastDay),
    hour: parts.hour,
    minute: parts.minute,
  }
}

function addYears(parts: StampDate, n: number): StampDate {
  return addMonths(parts, n * 12)
}

function addHours(parts: StampDate, n: number): StampDate {
  const d = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
  )
  d.setHours(d.getHours() + n)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

function addUnit(parts: StampDate, n: number, unit: string): StampDate {
  if (unit === 'd') return addDays(parts, n)
  if (unit === 'm') return addMonths(parts, n)
  if (unit === 'y') return addYears(parts, n)
  if (unit === 'h') return addHours(parts, n)
  throw new RefuseWrite(`unsupported repeater unit: ${unit}`)
}

/** Advance one Org timestamp cookie; keep brackets, time, repeater, warning. */
export function advanceRepeaterTimestamp(raw: string, now = new Date()): string {
  const parsed = raw.match(
    /^([<[])(\d{4}-\d{2}-\d{2})(?:([ \t]+)([A-Za-z]{2,3}))?(?:([ \t]+)(\d{1,2}:\d{2}(?::\d{2})?))?([\s\S]*)([>\]])$/,
  )
  if (!parsed) throw new RefuseWrite(`unrecognised timestamp: ${raw}`)
  const open = parsed[1]!
  const iso = parsed[2]!
  const wdSep = parsed[3] ?? ' '
  const timeSep = parsed[5] ?? ''
  const time = parsed[6] ?? null
  const tail = parsed[7] ?? ''
  const close = parsed[8]!

  const rep = REPEATER_RE.exec(tail)
  if (!rep) return raw

  const type = (rep[1] as '.' | '+' | undefined) ?? ''
  let n = Number(rep[2])
  let unit = rep[3]!
  if (unit === 'w') {
    n *= 7
    unit = 'd'
  }

  const [ys, ms, ds] = iso.split('-').map(Number) as [number, number, number]
  let hour: number | null = null
  let minute: number | null = null
  if (time) {
    const [hh, mm] = time.split(':').map(Number)
    hour = hh ?? null
    minute = mm ?? null
  }
  let current: StampDate = { year: ys, month: ms, day: ds, hour, minute }
  const today = todayParts(now)

  if (type === '.') {
    if (unit === 'h') {
      current = {
        year: today.year,
        month: today.month,
        day: today.day,
        hour: now.getHours(),
        minute: now.getMinutes(),
      }
    } else {
      current = {
        ...current,
        year: today.year,
        month: today.month,
        day: today.day,
      }
    }
  } else if (type === '+') {
    let guard = 0
    do {
      current = addUnit(current, n, unit)
      if (++guard > 1000) throw new RefuseWrite('repeater ++ overflow')
    } while (
      unit === 'h'
        ? new Date(
            current.year,
            current.month - 1,
            current.day,
            current.hour ?? 0,
            current.minute ?? 0,
          ).getTime() <= now.getTime()
        : compareDay(current, today) <= 0
    )
    current = addUnit(current, -n, unit)
  }

  current = addUnit(current, n, unit)

  const dateParts: DateParts = {
    year: current.year,
    month: current.month,
    day: current.day,
  }
  const newIso = isoOf(dateParts)
  const newWd = weekdayOf(dateParts)
  let newTime = ''
  if (time) {
    const hh = String(current.hour ?? 0).padStart(2, '0')
    const mm = String(current.minute ?? 0).padStart(2, '0')
    const sec = time.split(':').length > 2 ? `:${time.split(':')[2]}` : ''
    newTime = `${timeSep}${hh}:${mm}${sec}`
  }
  // Preserve original weekday separator when weekday was present; if absent, omit weekday.
  if (parsed[4]) {
    return `${open}${newIso}${wdSep}${newWd}${newTime}${tail}${close}`
  }
  return `${open}${newIso}${newTime}${tail}${close}`
}

function sectionKids(section: OrgNode): OrgNode[] | null {
  if (!('children' in section) || !Array.isArray(section.children)) return null
  return section.children as OrgNode[]
}

function planningOfSection(section: OrgNode): Planning | null {
  const kids = sectionKids(section)
  if (!kids) return null
  return (kids.find((c) => c.type === 'planning') as Planning | undefined) ?? null
}

function lastRepeatEdit(
  source: string,
  ctx: HeadlineContext,
  planning: Planning | null,
  inactiveStamp: string,
): Edit {
  const kids = sectionKids(ctx.section)
  const drawer = kids?.find((c) => c.type === 'property-drawer') as
    | (OrgNode & { children?: OrgNode[]; position?: { start: { offset: number }; end: { offset: number } } })
    | undefined

  if (drawer?.position) {
    const props = (drawer.children ?? []) as Array<
      OrgNode & {
        key?: string
        position?: { start: { offset: number }; end: { offset: number } }
      }
    >
    const existing = props.find((p) => p.type === 'node-property' && p.key === 'LAST_REPEAT')
    if (existing?.position) {
      const lineStart = existing.position.start.offset
      const lineEnd = existing.position.end.offset
      const line = source.slice(lineStart, lineEnd)
      const head = line.match(/^:LAST_REPEAT:[ \t]*/)
      if (!head) throw new RefuseWrite('unrecognised LAST_REPEAT property')
      return { start: lineStart + head[0].length, end: lineEnd, text: inactiveStamp }
    }
    const dStart = drawer.position.start.offset
    const dEnd = drawer.position.end.offset
    const drawerText = source.slice(dStart, dEnd)
    const endIdx = drawerText.lastIndexOf(':END:')
    if (endIdx < 0) throw new RefuseWrite('PROPERTIES drawer without :END:')
    const at = dStart + endIdx
    return { start: at, end: at, text: `:LAST_REPEAT: ${inactiveStamp}\n` }
  }

  let at: number
  if (planning?.position) {
    at = planning.position.end.offset
    if (source[at] === '\n') at += 1
  } else {
    at = ctx.eol
    if (source[at] === '\n') at += 1
    else {
      return {
        start: ctx.eol,
        end: ctx.eol,
        text: `\n:PROPERTIES:\n:LAST_REPEAT: ${inactiveStamp}\n:END:`,
      }
    }
  }
  return {
    start: at,
    end: at,
    text: `:PROPERTIES:\n:LAST_REPEAT: ${inactiveStamp}\n:END:\n`,
  }
}

export function markDoneInSource(
  source: string,
  path: number[],
  options: { now?: Date } = {},
): string {
  const now = options.now ?? new Date()
  const keywords = todoKeywordsFrom(source)
  const ctx = headlineContext(source, path, keywords)
  const planning = planningOfSection(ctx.section)

  const repeating: Timestamp[] = []
  if (planning?.scheduled && stampHasRepeater(planning.scheduled.rawValue)) {
    repeating.push(planning.scheduled)
  }
  if (planning?.deadline && stampHasRepeater(planning.deadline.rawValue)) {
    repeating.push(planning.deadline)
  }

  if (repeating.length === 0) {
    return updateTodoInSource(source, path, 'DONE')
  }

  const currentKw = ctx.parts.keyword
    ? source.slice(ctx.start + ctx.parts.keyword.start, ctx.start + ctx.parts.keyword.end)
    : null
  const { done } = todoStateLists(source)
  if (currentKw && done.includes(currentKw)) {
    return source
  }

  const edits: Array<Edit | null> = []
  const first = firstTodoState(source)

  if (currentKw && currentKw !== first) {
    const kwEdit: Edit = {
      start: ctx.start + ctx.parts.keyword!.start,
      end: ctx.start + ctx.parts.keyword!.end,
      text: first,
    }
    edits.push(kwEdit)
    edits.push(repadTags(source, ctx, first.length - currentKw.length))
  } else if (!currentKw) {
    const kwEdit: Edit = {
      start: ctx.start + ctx.parts.starsEnd,
      end: ctx.start + ctx.parts.starsEnd,
      text: `${first} `,
    }
    edits.push(kwEdit)
    edits.push(repadTags(source, ctx, first.length + 1))
  }

  for (const ts of repeating) {
    if (!ts.position) throw new RefuseWrite('no source position for repeating timestamp')
    const start = ts.position.start.offset
    const end = ts.position.end.offset
    const raw = source.slice(start, end)
    edits.push({ start, end, text: advanceRepeaterTimestamp(raw, now) })
  }

  edits.push(lastRepeatEdit(source, ctx, planning, formatOrgStamp(now, false)))
  return applyEdits(source, edits)
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
