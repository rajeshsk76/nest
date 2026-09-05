import type { OrgData, OrgNode } from 'uniorg'
import { RefuseWrite, applyEdits, parseOrg } from './org-core'

export type TableRowKind = 'standard' | 'rule'

export interface OrgTableRow {
  kind: TableRowKind
  cells: string[]
}

export interface OrgTableView {
  /** 0-based index among org-type tables in the file */
  index: number
  start: number
  end: number
  /** Section path of the containing headline, or null at file root */
  headlinePath: number[] | null
  rows: OrgTableRow[]
  /** Raw #+TBLFM formula body (without prefix); preserved on rewrite */
  tblfm: string
}

function flattenCellText(nodes: OrgNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      out += (node as { value: string }).value
    } else if ('children' in node && Array.isArray((node as { children: OrgNode[] }).children)) {
      out += flattenCellText((node as { children: OrgNode[] }).children)
    } else if ('value' in node && typeof (node as { value: unknown }).value === 'string') {
      out += (node as { value: string }).value
    }
  }
  return out
}

function rowFromNode(node: OrgNode): OrgTableRow {
  const row = node as {
    rowType?: string
    children?: OrgNode[]
  }
  if (row.rowType === 'rule') {
    return { kind: 'rule', cells: [] }
  }
  const cells = (row.children ?? [])
    .filter((c) => c.type === 'table-cell')
    .map((cell) => {
      const kids = (cell as { children?: OrgNode[] }).children ?? []
      return flattenCellText(kids).trim()
    })
  return { kind: 'standard', cells }
}

function walkTables(
  node: OrgNode,
  headlinePath: number[] | null,
  out: Array<Omit<OrgTableView, 'index'>>,
): void {
  if (node.type === 'table') {
    const table = node as {
      tableType?: string
      tblfm?: string
      position?: { start: { offset: number }; end: { offset: number } }
      children?: OrgNode[]
    }
    if (table.tableType && table.tableType !== 'org') return
    if (!table.position) throw new RefuseWrite('no source position for table')
    out.push({
      start: table.position.start.offset,
      end: table.position.end.offset,
      headlinePath: headlinePath ? [...headlinePath] : null,
      rows: (table.children ?? []).map(rowFromNode),
      tblfm: table.tblfm ?? '',
    })
    return
  }

  if (node.type === 'section') {
    const kids = ('children' in node && Array.isArray(node.children) ? node.children : []) as OrgNode[]
    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'section') {
        const childPath = [...(headlinePath ?? []), sectionIndex]
        walkTables(child, childPath, out)
        sectionIndex += 1
      } else {
        walkTables(child, headlinePath, out)
      }
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children as OrgNode[]) {
      if (child.type === 'section') {
        walkTables(child, [sectionIndex], out)
        sectionIndex += 1
      } else {
        walkTables(child as OrgNode, headlinePath, out)
      }
    }
  }
}

/** List Org pipe tables with absolute byte spans (org table type only). */
export function listTables(source: string): OrgTableView[] {
  const tree = parseOrg(source) as OrgData
  const raw: Array<Omit<OrgTableView, 'index'>> = []
  walkTables(tree, null, raw)
  return raw.map((t, index) => ({ ...t, index }))
}

function columnCount(rows: OrgTableRow[]): number {
  let n = 0
  for (const row of rows) {
    if (row.kind === 'standard') n = Math.max(n, row.cells.length)
  }
  return Math.max(1, n)
}

function normalizeRows(rows: OrgTableRow[], cols: number): OrgTableRow[] {
  return rows.map((row) => {
    if (row.kind === 'rule') return { kind: 'rule', cells: [] }
    const cells = row.cells.slice(0, cols)
    while (cells.length < cols) cells.push('')
    return { kind: 'standard', cells }
  })
}

/**
 * Serialize an Org table with Emacs-friendly column alignment.
 * Does not include a trailing blank line beyond the final table/TBLFM newline.
 */
export function serializeOrgTable(rows: OrgTableRow[], tblfm = ''): string {
  const cols = columnCount(rows)
  const normalized = normalizeRows(rows, cols)
  const widths = Array.from({ length: cols }, () => 1)
  for (const row of normalized) {
    if (row.kind !== 'standard') continue
    for (let c = 0; c < cols; c++) {
      widths[c] = Math.max(widths[c]!, (row.cells[c] ?? '').length)
    }
  }

  const lines: string[] = []
  for (const row of normalized) {
    if (row.kind === 'rule') {
      lines.push('|' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '|')
    } else {
      const parts = row.cells.map((cell, c) => ` ${(cell ?? '').padEnd(widths[c]!)} `)
      lines.push('|' + parts.join('|') + '|')
    }
  }

  let out = lines.join('\n') + '\n'
  if (tblfm.trim()) {
    const body = tblfm.trim().replace(/^#\+TBLFM:\s*/i, '')
    out += `#+TBLFM: ${body}\n`
  }
  return out
}

function assertSafeCellValue(value: string): string {
  if (/[\r\n]/.test(value)) throw new RefuseWrite('table cell contains a newline')
  if (value.includes('|')) throw new RefuseWrite('table cell contains a pipe')
  return value.trim()
}

function tableAt(source: string, tableIndex: number): OrgTableView {
  const tables = listTables(source)
  const table = tables[tableIndex]
  if (!table) throw new RefuseWrite('table not found')
  return table
}

/**
 * Update one cell and rewrite only that table's byte span (aligned).
 * `row` indexes all rows including hlines; rule rows refuse.
 */
export function updateTableCellInSource(
  source: string,
  tableIndex: number,
  row: number,
  col: number,
  value: string,
): string {
  const table = tableAt(source, tableIndex)
  const target = table.rows[row]
  if (!target) throw new RefuseWrite('table row out of range')
  if (target.kind === 'rule') throw new RefuseWrite('cannot edit table rule row')
  if (col < 0 || col >= columnCount(table.rows)) throw new RefuseWrite('table column out of range')

  const cleaned = assertSafeCellValue(value)
  const rows = table.rows.map((r, i) => {
    if (i !== row) return r
    const cells = [...r.cells]
    while (cells.length <= col) cells.push('')
    cells[col] = cleaned
    return { kind: 'standard' as const, cells }
  })

  const text = serializeOrgTable(rows, table.tblfm)
  return applyEdits(source, [{ start: table.start, end: table.end, text }])
}

/** Append an empty standard row; splices only the table span. */
export function addTableRowInSource(source: string, tableIndex: number): string {
  const table = tableAt(source, tableIndex)
  const cols = columnCount(table.rows)
  const rows = [...table.rows, { kind: 'standard' as const, cells: Array.from({ length: cols }, () => '') }]
  const text = serializeOrgTable(rows, table.tblfm)
  return applyEdits(source, [{ start: table.start, end: table.end, text }])
}
