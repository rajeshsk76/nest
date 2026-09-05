import { useEffect, useMemo, useState } from 'react'
import { CaptureBar } from './components/CaptureBar'
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
import {
  fileMeta,
  loadFiles,
  resetFiles,
  saveFiles,
  type FilesState,
} from './lib/storage'

type View = 'editor' | 'today'

export default function App() {
  const [files, setFiles] = useState<FilesState>(() => loadFiles())
  const [activeFile, setActiveFile] = useState<NestFileId>('inbox')
  const [view, setView] = useState<View>('editor')
  const [showSource, setShowSource] = useState(true)

  useEffect(() => {
    saveFiles(files)
  }, [files])

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
  }

  function handleCapture(text: string, withTimestamp: boolean) {
    setFiles((prev) => ({
      ...prev,
      inbox: captureTodo(prev.inbox, text, { withTimestamp }),
    }))
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
    setFiles((prev) => ({
      ...prev,
      [id]: markDoneInSource(prev[id], path),
    }))
  }

  function handleReset() {
    setFiles(resetFiles())
    setActiveFile('inbox')
    setView('editor')
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
          <button type="button" className="btn ghost" onClick={handleReset}>
            Reset fixtures
          </button>
        </div>
      </header>

      <CaptureBar onCapture={handleCapture} />

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
        {view === 'today' ? (
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
        <span>Local-first · plain .org files in memory + localStorage</span>
        <span>Week-1 starter · no sync, auth, or AI</span>
      </footer>
    </div>
  )
}
