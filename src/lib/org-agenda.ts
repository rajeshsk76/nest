import type { Priority, TodayFilters, TodayItem, ParsedCapture } from "./org-core"
import {
  formatOrgStamp,
  listHeadlines,
  sameDay,
  todayParts,
  normalizeTags,
} from "./org-core"

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
      } else if (!h.todo && reasons.length > 0) {
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
