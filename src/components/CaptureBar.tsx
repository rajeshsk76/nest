import { useState } from 'react'
import type { FormEvent } from 'react'

interface CaptureBarProps {
  onCapture: (text: string) => void
  disabled?: boolean
}

export function CaptureBar({ onCapture, disabled = false }: CaptureBarProps) {
  const [text, setText] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    const value = text.trim()
    if (!value) return
    onCapture(value)
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
        placeholder="Quick TODO — optional #A / [#B] and :tag: at end"
        autoComplete="off"
        disabled={disabled}
        title="Tip: Ship Nest #A :work:  or  [#C] Buy milk :errands: — CREATED is always added"
      />
      <button type="submit" className="btn primary" disabled={disabled}>
        Add
      </button>
    </form>
  )
}
