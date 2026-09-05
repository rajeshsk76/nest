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
