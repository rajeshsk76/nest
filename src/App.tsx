import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaptureBar } from './components/CaptureBar'
import { FolderBar } from './components/FolderBar'
import { OnboardingPanel } from './components/OnboardingPanel'
import { OutlineEditor } from './components/OutlineEditor'
import { SourcePanel } from './components/SourcePanel'
import { TodayView } from './components/TodayView'
import type { NestFileId } from './fixtures'
import type { Edit, SpliceResult } from './lib/org'
import {
  captureTodo,
  addTableRowInSource,
  demoteSubtreeInSource,
  exportOrgToHtml,
  insertHeadingInSource,
  listHeadlines,
  assertOnlySpansChanged,
  changedRegions,
  markDoneInSource,
  moveSubtreeInSource,
  promoteSubtreeInSource,
  isSpliceResult,
  RefuseWrite,
  siblingHtmlName,
  type DateParts,
  type Priority,
  type TodoKeyword,
  updateDeadlineInSource,
  updatePriorityInSource,
  updateScheduledInSource,
  updateSrcBodyInSource,
  updateTableCellInSource,
  updateTagsInSource,
  updateTitleInSource,
  updateTodoInSource,
} from './lib/org'
import { isDesktop } from './lib/platform'
import { recordUndo, takeUndo, type UndoState } from './lib/undo'
import {
  fileMeta,
  hasStoredFiles,
  loadFiles,
  loadFilesWithRemoteSeed,
  resetFiles,
  saveFiles,
  type FilesState,
} from './lib/storage'
import {
  pickWorkspaceFolder,
  readWorkspaceFiles,
  resetWorkspaceFiles,
  resolveWorkspaceOnce,
  StaleFileError,
  writeSiblingHtml,
  writeWorkspaceFile,
} from './lib/workspace'

type View = 'editor' | 'today'

type UndoEntry = {
  state: UndoState
  id: NestFileId
  after: string
  folder: string | null
  declared: Edit[] | null
  maxRegions: number
}

const desktop = isDesktop()

export default function App() {
  const [files, setFiles] = useState<FilesState>(() =>
    desktop ? { inbox: '', projects: '' } : loadFiles(),
  )
  const [activeFile, setActiveFile] = useState<NestFileId>('inbox')
  const [view, setView] = useState<View>('editor')
  const [showSource, setShowSource] = useState(false)
  const [rawMarkup, setRawMarkup] = useState(false)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [desktopReady, setDesktopReady] = useState(!desktop)
  const [createdDefault, setCreatedDefault] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const skipWebPersist = useRef(desktop)
  const [undo, setUndo] = useState<UndoEntry | null>(null)
  const undoRef = useRef<UndoEntry | null>(null)
  const restoringUndo = useRef<UndoEntry | null>(null)

  useEffect(() => {
    if (!desktop) {
      if (hasStoredFiles()) return
      let cancelled = false
      loadFilesWithRemoteSeed().then((seeded) => {
        if (!cancelled) setFiles(seeded)
      })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    ;(async () => {
      try {
        const result = await resolveWorkspaceOnce()
        if (cancelled) return
        setFolderPath(result.path)
        setFiles(result.files)
        setCreatedDefault(result.createdDefault)
        setDesktopReady(true)
        if (result.createdDefault) {
          setStatus('Created a default Nest folder under app data.')
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setStatus('Could not open a Nest folder. Try Change folder.')
          setDesktopReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (desktop || skipWebPersist.current) return
    saveFiles(files)
  }, [files])

  const persistFile = useCallback(
    async (id: NestFileId, source: string) => {
      if (!desktop || !folderPath) return
      try {
        await writeWorkspaceFile(folderPath, id, source)
      } catch (err) {
        console.error(err)
        setStatus(
          err instanceof StaleFileError
            ? `${id}.org changed on disk. Reload before editing.`
            : `Failed to write ${id}.org to disk.`,
        )
      }
    },
    [folderPath],
  )

  // Mirror of `files` readable synchronously, so edits never run inside a
  // state updater (updaters must stay pure and may run twice).
  const filesRef = useRef(files)
  useEffect(() => {
    filesRef.current = files
  }, [files])

  /** Run a mutation, refuse edits that smash too many regions, then write. */
  const applyEdit = useCallback(
    (
      id: NestFileId,
      mutate: (source: string) => string | SpliceResult,
      opts: { maxRegions?: number } = {},
    ) => {
      const before = filesRef.current[id]
      let after: string
      let declared: Edit[] | null = null
      try {
        const result = mutate(before)
        if (isSpliceResult(result)) {
          after = result.next
          declared = result.edits
        } else {
          after = result
        }
      } catch (err) {
        if (err instanceof RefuseWrite) {
          setStatus(`Nest won't edit ${id}.org: ${err.message}`)
          return
        }
        throw err
      }
      if (after === before) return
      // Undo revalidates the original edit in its original direction, including
      // its exact declared spans. Neither guard nor region limit is relaxed.
      const restoring = restoringUndo.current
      if (restoring) declared = restoring.declared
      const guardBefore = restoring ? after : before
      const guardAfter = restoring ? before : after
      if (declared) {
        // Strongest check: nothing moved outside the spans the mutator declared.
        try {
          assertOnlySpansChanged(guardBefore, guardAfter, declared)
        } catch (err) {
          if (err instanceof RefuseWrite) {
            setStatus(`Refused: ${err.message} in ${id}.org`)
            return
          }
          throw err
        }
      } else {
        // Mutators that still return a bare string keep the region count.
        // Migrating one to SpliceResult always tightens its guard.
        const regions = changedRegions(guardBefore, guardAfter)
        const maxRegions = opts.maxRegions ?? 1
        if (regions < 1 || regions > maxRegions) {
          setStatus(`Refused: that edit would change ${regions} regions of ${id}.org`)
          return
        }
      }
      if (!restoring) {
        const entry: UndoEntry = {
          state: recordUndo(undoRef.current?.state ?? { previous: null }, before),
          id, after, folder: folderPath, declared, maxRegions: opts.maxRegions ?? 1,
        }
        undoRef.current = entry
        setUndo(entry)
      }
      filesRef.current = { ...filesRef.current, [id]: after }
      setFiles((prev) => ({ ...prev, [id]: after }))
      void persistFile(id, after)
    },
    [persistFile, folderPath],
  )

  // A replacement/reload must not leave an undo action for a different source.
  const canUndo = undo !== null && undo.state.previous !== null &&
    undo.folder === folderPath && files[undo.id] === undo.after

  function handleUndo() {
    const entry = undoRef.current
    if (!entry || entry.folder !== folderPath || filesRef.current[entry.id] !== entry.after) return
    const taken = takeUndo(entry.state)
    if (!taken) return
    restoringUndo.current = entry
    try {
      applyEdit(entry.id, () => taken.restore, { maxRegions: entry.maxRegions })
      if (filesRef.current[entry.id] === taken.restore) {
        undoRef.current = null
        setUndo(null)
      }
    } finally {
      restoringUndo.current = null
    }
  }

  const activeSource = files[activeFile]
  const activeMeta = fileMeta(activeFile)

  const fileList = useMemo(
    () =>
      (Object.keys(files) as NestFileId[]).map((id) => ({
        id,
        source: files[id],
      })),
    [files],
  )

  const headlineCount = useMemo(() => {
    let n = 0
    for (const f of fileList) n += listHeadlines(f.source, f.id).length
    return n
  }, [fileList])

  const showOnboarding = desktopReady && headlineCount === 0

  function patchFile(id: NestFileId, source: string) {
    applyEdit(id, () => source)
  }

  function handleCapture(text: string) {
    applyEdit('inbox', (src) => captureTodo(src, text))
    setActiveFile('inbox')
    setView('editor')
  }

  function handleCycleTodo(path: number[], next: TodoKeyword) {
    applyEdit(activeFile, (src) => updateTodoInSource(src, path, next))
  }

  function handleRename(path: number[], title: string) {
    applyEdit(activeFile, (src) => updateTitleInSource(src, path, title))
  }

  function handleSetPriority(path: number[], priority: Priority) {
    applyEdit(activeFile, (src) => updatePriorityInSource(src, path, priority))
  }

  function handleSetTags(path: number[], tags: string[]) {
    applyEdit(activeFile, (src) => updateTagsInSource(src, path, tags))
  }

  function handleSetScheduled(path: number[], date: DateParts | null) {
    applyEdit(activeFile, (src) => updateScheduledInSource(src, path, date))
  }

  function handleSetDeadline(path: number[], date: DateParts | null) {
    applyEdit(activeFile, (src) => updateDeadlineInSource(src, path, date))
  }

  function handlePromote(path: number[]) {
    applyEdit(activeFile, (src) => promoteSubtreeInSource(src, path))
  }

  function handleDemote(path: number[]) {
    applyEdit(activeFile, (src) => demoteSubtreeInSource(src, path))
  }

  function handleMove(path: number[], direction: 'up' | 'down') {
    applyEdit(activeFile, (src) => moveSubtreeInSource(src, path, direction))
  }

  function handleInsertHeading(path: number[]) {
    applyEdit(activeFile, (src) => insertHeadingInSource(src, path))
  }

  function handleUpdateTableCell(
    tableIndex: number,
    row: number,
    col: number,
    value: string,
  ) {
    applyEdit(activeFile, (src) => updateTableCellInSource(src, tableIndex, row, col, value))
  }

  function handleAddTableRow(tableIndex: number) {
    applyEdit(activeFile, (src) => addTableRowInSource(src, tableIndex))
  }

  function handleUpdateSrcBody(blockIndex: number, body: string) {
    applyEdit(activeFile, (src) => updateSrcBodyInSource(src, blockIndex, body))
  }

  function handleMarkDone(fileId: string, path: number[]) {
    // Repeater Mark DONE may splice keyword + SCHEDULED/DEADLINE + LAST_REPEAT (≤3 hunks).
    applyEdit(fileId as NestFileId, (src) => markDoneInSource(src, path), { maxRegions: 3 })
  }

  function handleTodayPriority(fileId: string, path: number[], priority: Priority) {
    applyEdit(fileId as NestFileId, (src) => updatePriorityInSource(src, path, priority))
  }

  async function handleReset() {
    if (desktop && folderPath) {
      const seeds = await resetWorkspaceFiles(folderPath)
      setFiles(seeds)
    } else {
      setFiles(resetFiles())
    }
    undoRef.current = null
    setUndo(null)
    setActiveFile('inbox')
    setView('editor')
  }

  async function handleChangeFolder() {
    if (!desktop) return
    const picked = await pickWorkspaceFolder()
    if (!picked) return
    const nextFiles = await readWorkspaceFiles(picked)
    undoRef.current = null
    setUndo(null)
    setFolderPath(picked)
    setFiles(nextFiles)
    setCreatedDefault(false)
    setStatus(null)
  }


  function downloadHtml(fileName: string, html: string) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleExport() {
    const orgName = activeMeta.name
    const htmlName = siblingHtmlName(orgName)
    const html = exportOrgToHtml(activeSource, { title: orgName.replace(/\.org$/i, '') })
    // Web: always offer a download. Desktop: also write sibling next to the .org.
    downloadHtml(htmlName, html)
    if (desktop && folderPath) {
      try {
        const path = await writeSiblingHtml(folderPath, orgName, html)
        setStatus(`Exported ${htmlName} beside the .org (${path}). Original unchanged.`)
      } catch (err) {
        console.error(err)
        setStatus(`Downloaded ${htmlName}; could not write sibling on disk.`)
      }
    } else {
      setStatus(`Downloaded ${htmlName}. Original .org unchanged.`)
    }
  }

  function focusCapture() {
    const el = document.getElementById('capture-input')
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.select()
    }
  }

  return (
    <div className="app" onKeyDown={(event) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.repeat ||
          !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey ||
          event.key.toLowerCase() !== 'z') return
      const target = event.target
      if ((target instanceof HTMLElement && target.isContentEditable) ||
          (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="textbox"]'))) return
      if (!canUndo) return
      event.preventDefault()
      handleUndo()
    }}>
      <header className="shell-header">
        <div className="brand">
          <div className="logo" aria-hidden>
            N
          </div>
          <div>
            <h1>Nest</h1>
            <p className="tagline">Org mode for people who won&apos;t install Emacs.</p>
          </div>
        </div>
        <div className="shell-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={!canUndo}
            title={canUndo ? `Undo last edit to ${undo.id}.org (Ctrl+Z / Cmd+Z)` : 'No edit to undo'}
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={handleUndo}
          >
            Undo
          </button>
          <button type="button" className="btn ghost" onClick={() => void handleReset()}>
            Reset fixtures
          </button>
        </div>
      </header>

      {desktop && (
        <FolderBar
          path={folderPath}
          ready={desktopReady}
          createdDefault={createdDefault}
          onChangeFolder={() => void handleChangeFolder()}
        />
      )}

      {status && (
        <p className="status-banner" role="status">
          {status}
        </p>
      )}

      <CaptureBar onCapture={handleCapture} disabled={desktop && !desktopReady} />

      <nav className="tabs" aria-label="Primary">
        <button
          type="button"
          className={view === 'today' ? 'tab active' : 'tab'}
          onClick={() => setView('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={view === 'editor' && activeFile === 'inbox' ? 'tab active' : 'tab'}
          onClick={() => {
            setView('editor')
            setActiveFile('inbox')
          }}
        >
          inbox.org
        </button>
        <button
          type="button"
          className={
            view === 'editor' && activeFile === 'projects' ? 'tab active' : 'tab'
          }
          onClick={() => {
            setView('editor')
            setActiveFile('projects')
          }}
        >
          projects.org
        </button>
        <button
          type="button"
          className="tab"
          aria-pressed={rawMarkup}
          onClick={() => setRawMarkup((raw) => !raw)}
        >
          {rawMarkup ? 'Hide raw markup' : 'Show raw markup'}
        </button>
        {view === 'editor' && (
          <>
            <button
              type="button"
              className="tab quiet"
              onClick={() => void handleExport()}
            >
              Export HTML
            </button>
            <button
              type="button"
              className="tab"
              onClick={() => setShowSource((v) => !v)}
            >
              {showSource ? 'Hide source' : 'Show source'}
            </button>
          </>
        )}
      </nav>

      <main className="main">
        {!desktopReady ? (
          <p className="empty" style={{ padding: '1.2rem' }}>
            Opening Nest folder…
          </p>
        ) : showOnboarding ? (
          <OnboardingPanel
            desktop={desktop}
            onOpenFolder={desktop ? () => void handleChangeFolder() : undefined}
            onGoToday={() => setView('today')}
            onFocusCapture={focusCapture}
          />
        ) : view === 'today' ? (
          <TodayView
            files={fileList}
            rawMarkup={rawMarkup}
            onMarkDone={handleMarkDone}
            onSetPriority={handleTodayPriority}
          />
        ) : (
          <div className={showSource ? 'editor-layout split' : 'editor-layout'}>
            <section className="outline-panel">
              <header className="panel-header compact">
                <h2>{activeMeta.name}</h2>
                <p className="muted small">
                  Tab / chevron folds a subtree (view only). Alt+←/→ promote or
                  demote; Alt+↑/↓ move; Alt+Enter or +H inserts a sibling heading.
                  Titles edit inline; structure writes byte-splice.
                </p>
              </header>
              <OutlineEditor
                fileId={activeFile}
                source={activeSource}
                rawMarkup={rawMarkup}
                onCycleTodo={handleCycleTodo}
                onRename={handleRename}
                onSetPriority={handleSetPriority}
                onSetTags={handleSetTags}
                onSetScheduled={handleSetScheduled}
                onSetDeadline={handleSetDeadline}
                onPromote={handlePromote}
                onDemote={handleDemote}
                onMove={handleMove}
                onInsertHeading={handleInsertHeading}
                onUpdateTableCell={handleUpdateTableCell}
                onAddTableRow={handleAddTableRow}
                onUpdateSrcBody={handleUpdateSrcBody}
              />
            </section>
            {showSource && (
              <SourcePanel
                fileName={activeMeta.name}
                source={activeSource}
                onChange={(value) => patchFile(activeFile, value)}
              />
            )}
          </div>
        )}
      </main>

      <footer className="shell-footer">
        <span>
          {desktop
            ? 'Local-first · plain .org files on disk'
            : 'Local-first · plain .org files in memory + localStorage'}
        </span>
        <span>V2.2 · CREATED · filters · caret · no sync, auth, or AI</span>
      </footer>
    </div>
  )
}
