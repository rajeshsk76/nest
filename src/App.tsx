import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaptureBar } from './components/CaptureBar'
import { FolderBar } from './components/FolderBar'
import { OutlineEditor } from './components/OutlineEditor'
import { SourcePanel } from './components/SourcePanel'
import { TodayView } from './components/TodayView'
import type { NestFileId } from './fixtures'
import {
  captureTodo,
  markDoneInSource,
  type TodoKeyword,
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
        setStatus(`Failed to write ${id}.org to disk.`)
      }
    },
    [folderPath],
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

  function patchFile(id: NestFileId, source: string) {
    setFiles((prev) => ({ ...prev, [id]: source }))
    void persistFile(id, source)
  }

  function handleCapture(text: string, withTimestamp: boolean) {
    setFiles((prev) => {
      const inbox = captureTodo(prev.inbox, text, { withTimestamp })
      void persistFile('inbox', inbox)
      return { ...prev, inbox }
    })
    setActiveFile('inbox')
    setView('editor')
  }

  function handleCycleTodo(path: number[], next: TodoKeyword) {
    patchFile(activeFile, updateTodoInSource(activeSource, path, next))
  }

  function handleRename(path: number[], title: string) {
    patchFile(activeFile, updateTitleInSource(activeSource, path, title))
  }

  function handleMarkDone(fileId: string, path: number[]) {
    const id = fileId as NestFileId
    setFiles((prev) => {
      const next = markDoneInSource(prev[id], path)
      void persistFile(id, next)
      return { ...prev, [id]: next }
    })
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
          <button
            type="button"
            className="tab quiet"
            onClick={() => setShowSource((v) => !v)}
          >
            {showSource ? 'Hide source' : 'Show source'}
          </button>
        )}
      </nav>

      <main className="main">
        {!desktopReady ? (
          <p className="empty" style={{ padding: '1.2rem' }}>
            Opening Nest folder…
          </p>
        ) : view === 'today' ? (
          <TodayView files={fileList} onMarkDone={handleMarkDone} />
        ) : (
          <div className={showSource ? 'editor-layout split' : 'editor-layout'}>
            <section className="outline-panel">
              <header className="panel-header compact">
                <h2>{activeMeta.name}</h2>
                <p className="muted small">
                  Click the keyword to cycle TODO → DONE → clear. Titles edit
                  inline and stringify back to Org.
                </p>
              </header>
              <OutlineEditor
                fileId={activeFile}
                source={activeSource}
                onCycleTodo={handleCycleTodo}
                onRename={handleRename}
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
        <span>Week-2 desktop shell · no sync, auth, or AI</span>
      </footer>
    </div>
  )
}
