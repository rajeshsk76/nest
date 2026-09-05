import { useState } from 'react'
import type { FormEvent } from 'react'

interface CaptureBarProps {
  onCapture: (text: string, withTimestamp: boolean) => void
  disabled?: boolean
}

export function CaptureBar({ onCapture, disabled = false }: CaptureBarProps) {
  const [text, setText] = useState('')
  const [withTimestamp, setWithTimestamp] = useState(true)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
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
        disabled={disabled}
      />
      <label className="capture-check">
        <input
          type="checkbox"
          checked={withTimestamp}
          onChange={(e) => setWithTimestamp(e.target.checked)}
          disabled={disabled}
        />
        CREATED
      </label>
      <button type="submit" className="btn primary" disabled={disabled}>
        Add
      </button>
    </form>
  )
}
