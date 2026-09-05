import type { OrgData, OrgNode } from 'uniorg'
import { RefuseWrite, applyEdits, parseOrg } from './org-core'

export interface OrgSrcBlockView {
  /** 0-based index among src-blocks in the file */
  index: number
  /** Full block span: #+BEGIN_SRC … #+END_SRC (no trailing blank after fence) */
  start: number
  end: number
  /** Absolute offsets of the interior between fences (may be empty) */
  bodyStart: number
  bodyEnd: number
  language: string
  /** Raw header line including trailing newline */
  headerLine: string
  /** Raw end fence line without leading newline */
  endLine: string
  /** Body bytes between fences (usually ends with \\n when non-empty) */
  body: string
  /** Section path of the containing headline, or null at file root */
  headlinePath: number[] | null
}

function locateInterior(
  source: string,
  start: number,
  end: number,
): Pick<OrgSrcBlockView, 'bodyStart' | 'bodyEnd' | 'headerLine' | 'endLine' | 'body'> {
  const span = source.slice(start, end)
  const headerM = span.match(/^[ \t]*#\+begin_src[^\n]*\n/i)
  if (!headerM) throw new RefuseWrite('unrecognised src block header')
  // \\n before #+END_SRC; body includes that trailing newline when present.
  const endM = span.match(/\n([ \t]*#\+end_src[ \t]*)$/i)
  if (!endM || endM.index === undefined) throw new RefuseWrite('unrecognised src block end fence')
  const headerLine = headerM[0]
  const endLine = endM[1] ?? ''
  const bodyStart = start + headerLine.length
  // First character of the #+END_SRC line (= after the \\n matched above).
  const bodyEnd = start + endM.index + 1
  const body = source.slice(bodyStart, bodyEnd)
  return { bodyStart, bodyEnd, headerLine, endLine, body }
}

function walkSrcBlocks(
  node: OrgNode,
  headlinePath: number[] | null,
  out: Array<Omit<OrgSrcBlockView, 'index'>>,
  source: string,
): void {
  if (node.type === 'src-block') {
    const block = node as {
      language?: string | null
      position?: { start: { offset: number }; end: { offset: number } }
    }
    if (!block.position) throw new RefuseWrite('no source position for src block')
    const start = block.position.start.offset
    const end = block.position.end.offset
    const interior = locateInterior(source, start, end)
    const language = (block.language ?? '').trim() || 'src'
    out.push({
      start,
      end,
      language,
      headlinePath: headlinePath ? [...headlinePath] : null,
      ...interior,
    })
    return
  }

  if (node.type === 'section') {
    const kids = ('children' in node && Array.isArray(node.children) ? node.children : []) as OrgNode[]
    let sectionIndex = 0
    for (const child of kids) {
      if (child.type === 'section') {
        const childPath = [...(headlinePath ?? []), sectionIndex]
        walkSrcBlocks(child, childPath, out, source)
        sectionIndex += 1
      } else {
        walkSrcBlocks(child, headlinePath, out, source)
      }
    }
    return
  }

  if ('children' in node && Array.isArray(node.children)) {
    let sectionIndex = 0
    for (const child of node.children as OrgNode[]) {
      if (child.type === 'section') {
        walkSrcBlocks(child, [sectionIndex], out, source)
        sectionIndex += 1
      } else {
        walkSrcBlocks(child as OrgNode, headlinePath, out, source)
      }
    }
  }
}

/** List Org source blocks with absolute byte spans (fences + interior). */
export function listSrcBlocks(source: string): OrgSrcBlockView[] {
  const tree = parseOrg(source) as OrgData
  const raw: Array<Omit<OrgSrcBlockView, 'index'>> = []
  walkSrcBlocks(tree, null, raw, source)
  return raw.map((b, index) => ({ ...b, index }))
}

function srcAt(source: string, blockIndex: number): OrgSrcBlockView {
  const blocks = listSrcBlocks(source)
  const block = blocks[blockIndex]
  if (!block) throw new RefuseWrite('src block not found')
  return block
}

/**
 * Normalize body for splice: empty stays empty; non-empty always ends with \\n
 * so #+END_SRC remains on its own line.
 */
export function normalizeSrcBody(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (normalized === '') return ''
  return normalized.endsWith('\n') ? normalized : normalized + '\n'
}

/** Refuse bodies that would close or smash the Org fences. */
export function assertSafeSrcBody(body: string): string {
  if (/^[ \t]*#\+end_src[ \t]*$/im.test(body)) {
    throw new RefuseWrite('src body contains an #+END_SRC line')
  }
  return body
}

/**
 * Replace only the interior between #+BEGIN_SRC and #+END_SRC.
 * Header line (lang + switches) and end fence stay byte-identical.
 */
export function updateSrcBodyInSource(
  source: string,
  blockIndex: number,
  newBody: string,
): string {
  const block = srcAt(source, blockIndex)
  const text = assertSafeSrcBody(normalizeSrcBody(newBody))
  return applyEdits(source, [{ start: block.bodyStart, end: block.bodyEnd, text }])
}
