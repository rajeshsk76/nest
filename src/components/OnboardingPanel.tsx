interface OnboardingPanelProps {
  desktop?: boolean
  onOpenFolder?: () => void
  onGoToday: () => void
  onFocusCapture?: () => void
}

export function OnboardingPanel({
  desktop = false,
  onOpenFolder,
  onGoToday,
  onFocusCapture,
}: OnboardingPanelProps) {
  return (
    <section className="onboarding" aria-label="Getting started">
      <p className="onboarding-kicker">Nest</p>
      <h2>Org mode, without Emacs</h2>
      <p className="onboarding-lead">
        Plain <code>.org</code> files you own. Capture thoughts, work Today —
        that&apos;s the whole idea.
      </p>
      <ul className="onboarding-hints">
        <li>
          <strong>Capture</strong>
          <span>
            Type up top and press Add. Nest appends a TODO with a CREATED
            timestamp.
          </span>
          {onFocusCapture && (
            <button type="button" className="btn ghost" onClick={onFocusCapture}>
              Focus capture
            </button>
          )}
        </li>
        <li>
          <strong>Today</strong>
          <span>
            Open TODOs and anything SCHEDULED or due today. Filter by priority
            or tag.
          </span>
          <button type="button" className="btn" onClick={onGoToday}>
            Open Today
          </button>
        </li>
        {desktop && (
          <li>
            <strong>Open folder</strong>
            <span>
              Point Nest at a folder of <code>.org</code> files on disk. That
              folder is the source of truth.
            </span>
            {onOpenFolder && (
              <button type="button" className="btn primary" onClick={onOpenFolder}>
                Open folder
              </button>
            )}
          </li>
        )}
      </ul>
    </section>
  )
}
