import { useState } from 'react'
import type { FormEvent } from 'react'

interface CaptureBarProps {
  onCapture: (text: string, withTimestamp: boolean) => void
}

export function CaptureBar({ onCapture }: CaptureBarProps) {
  const [text, setText] = useState('')
  const [withTimestamp, setWithTimestamp] = useState(true)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    onCapture(value, withTimestamp)
    setText('')
  }

  return (
    <form className="capture" onSubmit={submit}>
      <label className="capture-label" htmlFor="capture-input">
        Capture
      </label>
      <input
        id="capture-input"
        className="capture-input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick TODO → appends to inbox.org"
        autoComplete="off"
      />
      <label className="capture-check">
        <input
          type="checkbox"
          checked={withTimestamp}
          onChange={(e) => setWithTimestamp(e.target.checked)}
        />
        CREATED
      </label>
      <button type="submit" className="btn primary">
        Add
      </button>
    </form>
  )
}
