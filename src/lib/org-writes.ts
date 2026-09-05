import type { OrgNode, Planning } from "uniorg"
import type { DateParts, Priority, TodoKeyword } from "./org-core"
import {
  RefuseWrite,
  applyEdits,
  headlineContext,
  isoOf,
  normalizeTags,
  spliceHead,
  todoKeywordsFrom,
  weekdayOf,
} from "./org-core"

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

  if (date && !ts) {
    const text = `${label}: <${isoOf(date)} ${weekdayOf(date)}>`
    if (planning?.position) {
      const at = planning.position.end.offset
      return applyEdits(source, [{ start: at, end: at, text: ` ${text}` }])
    }
    return applyEdits(source, [{ start: ctx.eol, end: ctx.eol, text: `\n${text}` }])
  }

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

export function updateScheduledInSource(
  source: string,
  path: number[],
  date: DateParts | null,
): string {
  return setPlanningField(source, path, 'scheduled', date)
}

export function updateDeadlineInSource(
  source: string,
  path: number[],
  date: DateParts | null,
): string {
  return setPlanningField(source, path, 'deadline', date)
}
