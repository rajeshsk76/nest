import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  cyclePriority,
  cycleTodo,
  listHeadlines,
  listSrcBlocks,
  listTables,
  normalizeTag,
  type DateParts,
  type HeadlineView,
  type OrgSrcBlockView,
  type OrgTableView,
  type Priority,
  type TodoKeyword,
} from '../lib/org'
import { MarkupText } from './MarkupText'
import { OrgSrcEditor } from './OrgSrcEditor'
import { OrgTableEditor, sameHeadlinePath } from './OrgTableEditor'
import { PlanningEditor } from './PlanningEditor'

interface OutlineEditorProps {
  fileId: string
  source: string
  rawMarkup?: boolean
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
  onSetScheduled: (path: number[], date: DateParts | null) => void
  onSetDeadline: (path: number[], date: DateParts | null) => void
  onPromote: (path: number[]) => void
  onDemote: (path: number[]) => void
  onMove: (path: number[], direction: 'up' | 'down') => void
  onInsertHeading: (path: number[]) => void
  onUpdateTableCell: (tableIndex: number, row: number, col: number, value: string) => void
  onAddTableRow: (tableIndex: number) => void
  onUpdateSrcBody: (blockIndex: number, body: string) => void
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
  rawMarkup,
  onRename,
}: {
  title: string
  level: number
  rawMarkup: boolean
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
        <MarkupText text={title} raw={rawMarkup} />
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

function pathPrefix(ancestor: number[], path: number[]): boolean {
  if (ancestor.length >= path.length) return false
  return ancestor.every((p, i) => path[i] === p)
}

function hasChildHeadlines(headlines: HeadlineView[], item: HeadlineView): boolean {
  return headlines.some((h) => pathPrefix(item.path, h.path) && h.path.length === item.path.length + 1)
}


function isBodyHiddenByFold(
  headlinePath: number[] | null,
  folded: Set<string>,
  headlines: HeadlineView[],
): boolean {
  if (!headlinePath) return false
  for (const other of headlines) {
    if (!folded.has(other.id)) continue
    // Hide body blocks when the containing headline is folded, or any ancestor.
    if (
      other.path.length <= headlinePath.length &&
      other.path.every((p, i) => headlinePath[i] === p)
    ) {
      return true
    }
  }
  return false
}

function isTableHiddenByFold(
  table: OrgTableView,
  folded: Set<string>,
  headlines: HeadlineView[],
): boolean {
  return isBodyHiddenByFold(table.headlinePath, folded, headlines)
}

function isSrcHiddenByFold(
  block: OrgSrcBlockView,
  folded: Set<string>,
  headlines: HeadlineView[],
): boolean {
  return isBodyHiddenByFold(block.headlinePath, folded, headlines)
}

function isHiddenByFold(item: HeadlineView, folded: Set<string>, headlines: HeadlineView[]): boolean {
  for (const other of headlines) {
    if (!folded.has(other.id)) continue
    if (pathPrefix(other.path, item.path)) return true
  }
  return false
}

function HeadlineRow({
  item,
  rawMarkup,
  folded,
  hasChildren,
  tables,
  srcBlocks,
  onToggleFold,
  onCycleTodo,
  onRename,
  onSetPriority,
  onSetTags,
  onSetScheduled,
  onSetDeadline,
  onPromote,
  onDemote,
  onMove,
  onInsertHeading,
  onUpdateTableCell,
  onAddTableRow,
  onUpdateSrcBody,
}: {
  item: HeadlineView
  rawMarkup: boolean
  folded: boolean
  hasChildren: boolean
  tables: OrgTableView[]
  srcBlocks: OrgSrcBlockView[]
  onToggleFold: () => void
  onCycleTodo: (path: number[], next: TodoKeyword) => void
  onRename: (path: number[], title: string) => void
  onSetPriority: (path: number[], priority: Priority) => void
  onSetTags: (path: number[], tags: string[]) => void
  onSetScheduled: (path: number[], date: DateParts | null) => void
  onSetDeadline: (path: number[], date: DateParts | null) => void
  onPromote: (path: number[]) => void
  onDemote: (path: number[]) => void
  onMove: (path: number[], direction: 'up' | 'down') => void
  onInsertHeading: (path: number[]) => void
  onUpdateTableCell: (tableIndex: number, row: number, col: number, value: string) => void
  onAddTableRow: (tableIndex: number) => void
  onUpdateSrcBody: (blockIndex: number, body: string) => void
}) {
  function onRowKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    if (e.key === 'Tab' && hasChildren) {
      e.preventDefault()
      onToggleFold()
      return
    }
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      onPromote(item.path)
      return
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault()
      onDemote(item.path)
      return
    }
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      onMove(item.path, 'up')
      return
    }
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      onMove(item.path, 'down')
      return
    }
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault()
      onInsertHeading(item.path)
    }
  }

  return (
    <>
    <div
      className="headline-row"
      style={{ paddingLeft: `${(item.level - 1) * 1.25}rem` }}
      tabIndex={0}
      onKeyDown={onRowKeyDown}
    >
      <div className="headline-controls">
        {hasChildren ? (
          <button
            type="button"
            className={`fold-chevron${folded ? ' folded' : ''}`}
            onClick={onToggleFold}
            title={folded ? 'Unfold subtree (Tab)' : 'Fold subtree (Tab)'}
            aria-label={folded ? 'Unfold subtree' : 'Fold subtree'}
            aria-expanded={!folded}
          >
            {folded ? '▶' : '▼'}
          </button>
        ) : (
          <span className="fold-spacer" aria-hidden>
            ·
          </span>
        )}
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
        rawMarkup={rawMarkup}
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
        <div className="struct-actions" role="group" aria-label="Structure">
          <button
            type="button"
            className="struct-btn"
            title="Promote (Alt+←)"
            onClick={() => onPromote(item.path)}
          >
            ←
          </button>
          <button
            type="button"
            className="struct-btn"
            title="Demote (Alt+→)"
            onClick={() => onDemote(item.path)}
          >
            →
          </button>
          <button
            type="button"
            className="struct-btn"
            title="Move up (Alt+↑)"
            onClick={() => onMove(item.path, 'up')}
          >
            ↑
          </button>
          <button
            type="button"
            className="struct-btn"
            title="Move down (Alt+↓)"
            onClick={() => onMove(item.path, 'down')}
          >
            ↓
          </button>
          <button
            type="button"
            className="struct-btn"
            title="Insert heading (Alt+Enter)"
            onClick={() => onInsertHeading(item.path)}
          >
            +H
          </button>
        </div>
      </div>
    </div>
      {!folded &&
        [
          ...tables.map((table) => ({ kind: 'table' as const, start: table.start, table })),
          ...srcBlocks.map((block) => ({ kind: 'src' as const, start: block.start, block })),
        ]
          .sort((a, b) => a.start - b.start)
          .map((entry) => (
            <div
              key={entry.kind === 'table' ? `table-${entry.table.index}` : `src-${entry.block.index}`}
              className={entry.kind === 'table' ? 'headline-table' : 'headline-src'}
              style={{ paddingLeft: `${(item.level - 1) * 1.25 + 1.8}rem` }}
            >
              {entry.kind === 'table' ? (
                <OrgTableEditor
                  table={entry.table}
                  onUpdateCell={onUpdateTableCell}
                  onAddRow={onAddTableRow}
                />
              ) : (
                <OrgSrcEditor block={entry.block} onUpdateBody={onUpdateSrcBody} />
              )}
            </div>
          ))}
    </>
  )
}

export function OutlineEditor({
  fileId,
  source,
  rawMarkup = false,
  onCycleTodo,
  onRename,
  onSetPriority,
  onSetTags,
  onSetScheduled,
  onSetDeadline,
  onPromote,
  onDemote,
  onMove,
  onInsertHeading,
  onUpdateTableCell,
  onAddTableRow,
  onUpdateSrcBody,
}: OutlineEditorProps) {
  const headlines = useMemo(() => listHeadlines(source, fileId), [source, fileId])
  const tables = useMemo(() => listTables(source), [source])
  const srcBlocks = useMemo(() => listSrcBlocks(source), [source])
  // Fold is visibility-only — never written to disk.
  const [folded, setFolded] = useState<Set<string>>(() => new Set())

  function toggleFold(id: string) {
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const visible = headlines.filter((item) => !isHiddenByFold(item, folded, headlines))

  const rootTables = tables.filter(
    (t) => t.headlinePath === null && !isTableHiddenByFold(t, folded, headlines),
  )
  const rootSrc = srcBlocks.filter(
    (b) => b.headlinePath === null && !isSrcHiddenByFold(b, folded, headlines),
  )

  return (
    <div className="outline">
      {[
        ...rootTables.map((table) => ({ kind: 'table' as const, start: table.start, table })),
        ...rootSrc.map((block) => ({ kind: 'src' as const, start: block.start, block })),
      ]
        .sort((a, b) => a.start - b.start)
        .map((entry) =>
          entry.kind === 'table' ? (
            <OrgTableEditor
              key={`root-table-${entry.table.index}`}
              table={entry.table}
              onUpdateCell={onUpdateTableCell}
              onAddRow={onAddTableRow}
            />
          ) : (
            <OrgSrcEditor
              key={`root-src-${entry.block.index}`}
              block={entry.block}
              onUpdateBody={onUpdateSrcBody}
            />
          ),
        )}
      {visible.map((item) => (
        <HeadlineRow
          key={item.id}
          item={item}
          rawMarkup={rawMarkup}
          folded={folded.has(item.id)}
          hasChildren={hasChildHeadlines(headlines, item)}
          tables={tables.filter(
            (t) =>
              sameHeadlinePath(t.headlinePath, item.path) &&
              !isTableHiddenByFold(t, folded, headlines),
          )}
          srcBlocks={srcBlocks.filter(
            (b) =>
              sameHeadlinePath(b.headlinePath, item.path) &&
              !isSrcHiddenByFold(b, folded, headlines),
          )}
          onToggleFold={() => toggleFold(item.id)}
          onCycleTodo={onCycleTodo}
          onRename={onRename}
          onSetPriority={onSetPriority}
          onSetTags={onSetTags}
          onSetScheduled={onSetScheduled}
          onSetDeadline={onSetDeadline}
          onPromote={onPromote}
          onDemote={onDemote}
          onMove={onMove}
          onInsertHeading={onInsertHeading}
          onUpdateTableCell={onUpdateTableCell}
          onAddTableRow={onAddTableRow}
          onUpdateSrcBody={onUpdateSrcBody}
        />
      ))}
    </div>
  )
}
