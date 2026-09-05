interface FolderBarProps {
  path: string | null
  ready: boolean
  onChangeFolder: () => void
  createdDefault?: boolean
}

export function FolderBar({
  path,
  ready,
  onChangeFolder,
  createdDefault,
}: FolderBarProps) {
  return (
    <div className="folder-bar">
      <div className="folder-bar-main">
        <span className="folder-label">Folder</span>
        <code className="folder-path" title={path ?? undefined}>
          {ready ? path ?? 'Not set' : 'Opening…'}
        </code>
        {createdDefault && (
          <span className="folder-hint">Default under app data</span>
        )}
      </div>
      <button type="button" className="btn ghost" onClick={onChangeFolder}>
        {path ? 'Change folder' : 'Open folder'}
      </button>
    </div>
  )
}
