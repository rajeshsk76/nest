import { useEffect, useMemo, useState } from 'react'
import {
  collectTodayAgenda,
  collectUniqueTags,
  emptyTodayFilters,
  filterTodayItems,
  type TodayFilters,
  type TodayItem,
} from '../lib/org'

const FILTER_STORAGE_KEY = 'nest.today.filters.v1'

interface TodayViewProps {
  files: Array<{ id: string; source: string }>
  onMarkDone: (fileId: string, path: number[]) => void
  onSetPriority?: (fileId: string, path: number[], priority: TodayItem['priority']) => void
}

function reasonLabel(reason: TodayItem['reason']): string {
  if (reason === 'deadline') return 'DEADLINE'
  if (reason === 'scheduled') return 'SCHEDULED'
  return 'TODO'
}

function loadStickyFilters(): TodayFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return emptyTodayFilters()
    const parsed = JSON.parse(raw) as Partial<TodayFilters>
    return {
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch {
    return emptyTodayFilters()
  }
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function TodayView({ files, onMarkDone, onSetPriority }: TodayViewProps) {
  const [filters, setFilters] = useState<TodayFilters>(() =>
    typeof localStorage !== 'undefined' ? loadStickyFilters() : emptyTodayFilters(),
  )

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // ignore quota / private mode
    }
  }, [filters])

  const items = useMemo(() => collectTodayAgenda(files), [files])
  const availableTags = useMemo(() => collectUniqueTags(files), [files])
  const visible = useMemo(() => filterTodayItems(items, filters), [items, filters])

  const stamped = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hasFilters = filters.priorities.length > 0 || filters.tags.length > 0

  return (
    <section className="today">
      <header className="panel-header">
        <div>
          <h2>Today</h2>
          <p className="muted">{stamped}</p>
        </div>
        <p className="muted small">
          Open TODOs plus items SCHEDULED or DEADLINE for today. Filter by
          priority or tag (sticky). Sorted A → B → C → none.
        </p>
      </header>

      <div className="today-filters" aria-label="Today filters">
        <div className="filter-group">
          <span className="filter-label">Priority</span>
          {(['A', 'B', 'C', 'none'] as const).map((p) => {
            const active = filters.priorities.includes(p)
            return (
              <button
                key={p}
                type="button"
                className={`filter-chip${active ? ' active' : ''}${p !== 'none' ? ` priority-${p}` : ''}`}
                aria-pressed={active}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    priorities: toggleValue(prev.priorities, p),
                  }))
                }
              >
                {p === 'none' ? 'none' : `#${p}`}
              </button>
            )
          })}
        </div>
        {availableTags.length > 0 && (
          <div className="filter-group">
            <span className="filter-label">Tags</span>
            {availableTags.map((tag) => {
              const active = filters.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={`filter-chip tag-filter${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      tags: toggleValue(prev.tags, tag),
                    }))
                  }
                >
                  :{tag}:
                </button>
              )
            })}
          </div>
        )}
        {hasFilters && (
          <button
            type="button"
            className="btn ghost filter-clear"
            onClick={() => setFilters(emptyTodayFilters())}
          >
            Clear filters
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="empty">Nothing for today. Enjoy the quiet.</p>
      ) : visible.length === 0 ? (
        <p className="empty">No items match these filters.</p>
      ) : (
        <ul className="today-list">
          {visible.map((item) => (
            <li key={item.id} className="today-item">
              <div className="today-main">
                <span className={`reason reason-${item.reason}`}>
                  {reasonLabel(item.reason)}
                </span>
                {item.priority ? (
                  <button
                    type="button"
                    className={`priority-badge priority-${item.priority}`}
                    title="Cycle priority"
                    disabled={!onSetPriority}
                    onClick={() => {
                      if (!onSetPriority) return
                      const order: Array<TodayItem['priority']> = ['A', 'B', 'C', null]
                      const idx = order.indexOf(item.priority)
                      const next = order[(idx + 1) % order.length] ?? null
                      onSetPriority(item.fileId, item.path, next)
                    }}
                  >
                    #{item.priority}
                  </button>
                ) : (
                  onSetPriority && (
                    <button
                      type="button"
                      className="priority-badge priority-none"
                      title="Set priority A"
                      onClick={() => onSetPriority(item.fileId, item.path, 'A')}
                    >
                      #
                    </button>
                  )
                )}
                <span className="today-title">{item.title}</span>
                {item.tags.map((tag) => (
                  <span key={tag} className="tag">
                    :{tag}:
                  </span>
                ))}
                <span className="muted small">{item.fileId}.org</span>
              </div>
              <div className="today-actions">
                {item.scheduled && (
                  <span className="chip">S {item.scheduled}</span>
                )}
                {item.deadline && (
                  <span className="chip danger">D {item.deadline}</span>
                )}
                {item.todo === 'TODO' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onMarkDone(item.fileId, item.path)}
                  >
                    Mark DONE
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
