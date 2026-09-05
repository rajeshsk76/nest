import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  cyclePriority,
  cycleTodo,
  listHeadlines,
  normalizeTag,
  type DateParts,
  type HeadlineView,
  type Priority,
  type TodoKeyword,
} from '../lib/org'
import { MarkupText } from './MarkupText'
import { PlanningEditor } from './PlanningEditor'

interface OutlineEditorProps {
  fileId: string
  source: string
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
  onSetScheduled: (path: number[], date: DateParts | null) => void
  onSetDeadline: (path: number[], date: DateParts | null) => void
}

function TodoBadge({
  todo,
  onClick,
}: {
  todo: TodoKeyword
  onClick: () => void
}) {
  const label = todo ?? '·'
  return (
    <button
      type="button"
      className={`todo-badge todo-${todo ?? 'none'}`}
      onClick={onClick}
      title="Cycle TODO → DONE → clear"
    >
      {label}
    </button>
  )
}

function PriorityBadge({
  priority,
  onClick,
}: {
  priority: Priority
  onClick: () => void
}) {
  const label = priority ? `#${priority}` : '#'
  return (
    <button
      type="button"
      className={`priority-badge priority-${priority ?? 'none'}`}
      onClick={onClick}
      title="Cycle priority A → B → C → none"
      aria-label={priority ? `Priority ${priority}` : 'No priority'}
    >
      {label}
    </button>
  )
}

/**
 * Outline title: rendered Org markup when idle; raw markers while editing.
 * Local draft while focused keeps the caret stable across parent re-parses.
 */
function HeadlineTitle({
  title,
  level,
  onRename,
}: {
  title: string
  level: number
  onRename: (title: string) => void
}) {
  const [draft, setDraft] = useState(title)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(title)
  }, [title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!editing) {
    return (
      <div
        className="headline-title headline-title-display"
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
        aria-label={`Headline level ${level}`}
        title="Click to edit title (raw Org markers)"
      >
        <MarkupText text={title} />
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      className="headline-title"
      value={draft}
      onBlur={() => {
        setEditing(false)
        if (draft !== title) onRename(draft)
        else setDraft(title)
      }}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        onRename(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          if (draft !== title) onRename(title)
          setDraft(title)
          setEditing(false)
        }
      }}
      aria-label={`Headline level ${level}`}
    />
  )
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    if (!tag) return
    if (tags.includes(tag)) {
      setDraft('')
      setOpen(false)
      return
    }
    onChange([...tags, tag])
    setDraft('')
    setOpen(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    addTag(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setDraft('')
      setOpen(false)
    }
  }

  return (
    <div className="tag-editor">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag tag-chip"
          title={`Remove :${tag}:`}
          onClick={() => onChange(tags.filter((t) => t !== tag))}
        >
          :{tag}: <span aria-hidden>×</span>
        </button>
      ))}
      {open ? (
        <form className="tag-add-form" onSubmit={submit}>
          <input
            className="tag-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (!draft.trim()) setOpen(false)
            }}
            placeholder="tag"
            aria-label="Add tag"
            autoFocus
          />
        </form>
      ) : (
        <button
          type="button"
          className="tag-add"
          onClick={() => setOpen(true)}
          title="Add tag"
        >
          +tag
        </button>
      )}
    </div>
  )
}

function HeadlineRow({
  item,
  onCycleTodo,
  onRename,
  onSetPriority,
  onSetTags,
  onSetScheduled,
  onSetDeadline,
}: {
  item: HeadlineView
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
  onSetScheduled: (path: number[], date: DateParts | null) => void
  onSetDeadline: (path: number[], date: DateParts | null) => void
}) {
  return (
    <div
      className="headline-row"
      style={{ paddingLeft: `${(item.level - 1) * 1.25}rem` }}
    >
      <div className="headline-controls">
        <TodoBadge
          todo={item.todo}
          onClick={() => onCycleTodo(item.path, cycleTodo(item.todo))}
        />
        <PriorityBadge
          priority={item.priority}
          onClick={() => onSetPriority(item.path, cyclePriority(item.priority))}
        />
      </div>
      <HeadlineTitle
        title={item.title}
        level={item.level}
        onRename={(title) => onRename(item.path, title)}
      />
      <div className="headline-meta">
        <PlanningEditor
          scheduled={item.scheduledDate}
          deadline={item.deadlineDate}
          scheduledDisplay={item.scheduled}
          deadlineDisplay={item.deadline}
          onSetScheduled={(date) => onSetScheduled(item.path, date)}
          onSetDeadline={(date) => onSetDeadline(item.path, date)}
        />
        <TagEditor
          tags={item.tags}
          onChange={(tags) => onSetTags(item.path, tags)}
        />
      </div>
    </div>
  )
}

export function OutlineEditor({
  fileId,
  source,
  onCycleTodo,
  onRename,
  onSetPriority,
  onSetTags,
  onSetScheduled,
  onSetDeadline,
}: OutlineEditorProps) {
  const headlines = listHeadlines(source, fileId)

  if (headlines.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">This file is quiet.</p>
        <p className="empty-body">
          Capture a TODO above — Nest writes it here as plain Org.
        </p>
      </div>
    )
  }

  return (
    <div className="outline">
      {headlines.map((item) => (
        <HeadlineRow
          key={item.id}
          item={item}
          onCycleTodo={onCycleTodo}
          onRename={onRename}
          onSetPriority={onSetPriority}
          onSetTags={onSetTags}
          onSetScheduled={onSetScheduled}
          onSetDeadline={onSetDeadline}
        />
      ))}
    </div>
  )
}
