import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaptureBar } from './components/CaptureBar'
import { FolderBar } from './components/FolderBar'
import { OnboardingPanel } from './components/OnboardingPanel'
import { OutlineEditor } from './components/OutlineEditor'
import { SourcePanel } from './components/SourcePanel'
import { TodayView } from './components/TodayView'
import type { NestFileId } from './fixtures'
import {
  captureTodo,
  addTableRowInSource,
  demoteSubtreeInSource,
  exportOrgToHtml,
  insertHeadingInSource,
  listHeadlines,
  changedRegions,
  markDoneInSource,
  moveSubtreeInSource,
  promoteSubtreeInSource,
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

const desktop = isDesktop()

export default function App() {
  const [files, setFiles] = useState<FilesState>(() =>
    desktop ? { inbox: '', projects: '' } : loadFiles(),
  )
  const [activeFile, setActiveFile] = useState<NestFileId>('inbox')
  const [view, setView] = useState<View>('editor')
  const [showSource, setShowSource] = useState(true)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [desktopReady, setDesktopReady] = useState(!desktop)
  const [createdDefault, setCreatedDefault] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const skipWebPersist = useRef(desktop)

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
      mutate: (source: string) => string,
      opts: { maxRegions?: number } = {},
    ) => {
      const before = filesRef.current[id]
      let after: string
      try {
        after = mutate(before)
      } catch (err) {
        if (err instanceof RefuseWrite) {
          setStatus(`Nest won't edit ${id}.org: ${err.message}`)
          return
        }
        throw err
      }
      if (after === before) return
      const regions = changedRegions(before, after)
      const maxRegions = opts.maxRegions ?? 1
      if (regions < 1 || regions > maxRegions) {
        setStatus(`Refused: that edit would change ${regions} regions of ${id}.org`)
        return
      }
      filesRef.current = { ...filesRef.current, [id]: after }
      setFiles((prev) => ({ ...prev, [id]: after }))
      void persistFile(id, after)
    },
    [persistFile],
  )

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
    setActiveFile('inbox')
    setView('editor')
  }

  async function handleChangeFolder() {
    if (!desktop) return
    const picked = await pickWorkspaceFolder()
    if (!picked) return
    const nextFiles = await readWorkspaceFiles(picked)
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
    <div className="app">
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
