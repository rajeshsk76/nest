import { useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  cyclePriority,
  cycleTodo,
  listHeadlines,
  normalizeTag,
  type HeadlineView,
  type Priority,
  type TodoKeyword,
} from '../lib/org'

interface OutlineEditorProps {
  fileId: string
  source: string
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
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
}: {
  item: HeadlineView
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
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
      <input
        className="headline-title"
        value={item.title}
        onChange={(e) => onRename(item.path, e.target.value)}
        aria-label={`Headline level ${item.level}`}
      />
      <div className="headline-meta">
        {item.scheduled && <span className="chip">S {item.scheduled}</span>}
        {item.deadline && <span className="chip danger">D {item.deadline}</span>}
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
}: OutlineEditorProps) {
  const headlines = listHeadlines(source, fileId)

  if (headlines.length === 0) {
    return <p className="empty">No headlines yet. Capture something, or edit the source.</p>
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
        />
      ))}
    </div>
  )
}
