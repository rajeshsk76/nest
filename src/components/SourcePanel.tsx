interface SourcePanelProps {
  fileName: string
  source: string
  onChange: (value: string) => void
}

export function SourcePanel({ fileName, source, onChange }: SourcePanelProps) {
  return (
    <section className="source-panel">
      <header className="panel-header compact">
        <h2>Source · {fileName}</h2>
        <p className="muted small">
          Plain Org text. Edits parse on the next outline render.
        </p>
      </header>
      <textarea
        className="source-editor"
        value={source}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`${fileName} source`}
      />
    </section>
  )
}
