import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { OrgTableView } from '../lib/org'

interface OrgTableEditorProps {
  table: OrgTableView
  onUpdateCell: (tableIndex: number, row: number, col: number, value: string) => void
  onAddRow: (tableIndex: number) => void
}

function TableCellInput({
  tableIndex,
  row,
  col,
  value,
  onCommit,
  onTab,
}: {
  tableIndex: number
  row: number
  col: number
  value: string
  onCommit: (value: string) => void
  onTab: (shift: boolean) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])

  function commit() {
    setFocused(false)
    if (draft !== value) onCommit(draft)
    else setDraft(value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      const shift = e.shiftKey
      // Commit before moving so the splice lands with the new value.
      if (draft !== value) onCommit(draft)
      requestAnimationFrame(() => onTab(shift))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      ref.current?.blur()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setDraft(value)
      setFocused(false)
      ref.current?.blur()
    }
  }

  return (
    <input
      ref={ref}
      className="org-table-cell"
      data-table-index={tableIndex}
      data-table-row={row}
      data-table-col={col}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      aria-label={`Table ${tableIndex + 1} cell row ${row + 1} column ${col + 1}`}
    />
  )
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Focus next/prev editable cell in the same table (skips rule rows). */
function focusNeighbor(
  tableIndex: number,
  row: number,
  col: number,
  colCount: number,
  rows: OrgTableView['rows'],
  backward: boolean,
) {
  const editable: Array<{ row: number; col: number }> = []
  for (let r = 0; r < rows.length; r++) {
    if (rows[r]!.kind !== 'standard') continue
    for (let c = 0; c < colCount; c++) editable.push({ row: r, col: c })
  }
  const at = editable.findIndex((e) => e.row === row && e.col === col)
  if (at < 0) return
  const next = editable[backward ? at - 1 : at + 1]
  if (!next) return
  const el = document.querySelector<HTMLInputElement>(
    `input.org-table-cell[data-table-index="${tableIndex}"][data-table-row="${next.row}"][data-table-col="${next.col}"]`,
  )
  el?.focus()
  el?.select()
}

export function OrgTableEditor({ table, onUpdateCell, onAddRow }: OrgTableEditorProps) {
  const colCount = Math.max(
    1,
    ...table.rows.filter((r) => r.kind === 'standard').map((r) => r.cells.length),
  )

  return (
    <div className="org-table-wrap">
      <table className="org-table">
        <tbody>
          {table.rows.map((row, ri) =>
            row.kind === 'rule' ? (
              <tr key={`rule-${ri}`} className="org-table-rule">
                <td colSpan={colCount}>
                  <hr />
                </td>
              </tr>
            ) : (
              <tr key={`row-${ri}`}>
                {Array.from({ length: colCount }, (_, ci) => (
                  <td key={ci}>
                    <TableCellInput
                      tableIndex={table.index}
                      row={ri}
                      col={ci}
                      value={row.cells[ci] ?? ''}
                      onCommit={(value) => onUpdateCell(table.index, ri, ci, value)}
                      onTab={(shift) =>
                        focusNeighbor(table.index, ri, ci, colCount, table.rows, shift)
                      }
                    />
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
      <button
        type="button"
        className="org-table-add-row"
        title="Add table row"
        onClick={() => onAddRow(table.index)}
      >
        + row
      </button>
    </div>
  )
}

export function sameHeadlinePath(
  tablePath: number[] | null,
  headlinePath: number[],
): boolean {
  if (!tablePath) return false
  return pathsEqual(tablePath, headlinePath)
}
