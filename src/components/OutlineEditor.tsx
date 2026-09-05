import {
  cycleTodo,
  listHeadlines,
  type HeadlineView,
  type TodoKeyword,
} from '../lib/org'

interface OutlineEditorProps {
  fileId: string
  source: string
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
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

function HeadlineRow({
  item,
  onCycleTodo,
  onRename,
}: {
  item: HeadlineView
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
}) {
  return (
    <div
      className="headline-row"
      style={{ paddingLeft: `${(item.level - 1) * 1.25}rem` }}
    >
      <TodoBadge
        todo={item.todo}
        onClick={() => onCycleTodo(item.path, cycleTodo(item.todo))}
      />
      <input
        className="headline-title"
        value={item.title}
        onChange={(e) => onRename(item.path, e.target.value)}
        aria-label={`Headline level ${item.level}`}
      />
      <div className="headline-meta">
        {item.scheduled && <span className="chip">S {item.scheduled}</span>}
        {item.deadline && <span className="chip danger">D {item.deadline}</span>}
        {item.tags.map((tag) => (
          <span key={tag} className="tag">
            :{tag}:
          </span>
        ))}
      </div>
    </div>
  )
}

export function OutlineEditor({
  fileId,
  source,
  onCycleTodo,
  onRename,
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
        />
      ))}
    </div>
  )
}
