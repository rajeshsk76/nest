export interface UndoState {
  previous: string | null
}

/** Replace the one available snapshot; never mutate the caller's state. */
export function recordUndo(_state: UndoState, before: string): UndoState {
  return { previous: before }
}

/** Consume the snapshot. Empty source is valid; only null means unavailable. */
export function takeUndo(state: UndoState): { restore: string; state: UndoState } | null {
  if (state.previous === null) return null
  return { restore: state.previous, state: { previous: null } }
}
