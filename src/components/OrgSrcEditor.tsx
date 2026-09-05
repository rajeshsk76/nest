import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { OrgSrcBlockView } from '../lib/org'

interface OrgSrcEditorProps {
  block: OrgSrcBlockView
  onUpdateBody: (blockIndex: number, body: string) => void
}

export function OrgSrcEditor({ block, onUpdateBody }: OrgSrcEditorProps) {
  const [draft, setDraft] = useState(block.body)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!focused) setDraft(block.body)
  }, [block.body, focused])

  function commit() {
    setFocused(false)
    if (draft !== block.body) onUpdateBody(block.index, draft)
    else setDraft(block.body)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setDraft(block.body)
      setFocused(false)
      ref.current?.blur()
    }
  }

  const rows = Math.max(2, Math.min(16, (draft.match(/\n/g)?.length ?? 0) + 1))

  return (
    <div className="org-src-wrap">
      <div className="org-src-header">
        <span className="org-src-badge" title="Org source block language">
          {block.language}
        </span>
        <span className="org-src-hint">src · never executed</span>
      </div>
      <textarea
        ref={ref}
        className="org-src-body"
        value={draft}
        rows={rows}
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label={`${block.language} source block`}
      />
    </div>
  )
}
