import {
  datePartsFromInput,
  datePartsToInput,
  todayParts,
  type DateParts,
} from '../lib/org'

interface PlanningFieldProps {
  kind: 'scheduled' | 'deadline'
  value: DateParts | null
  display: string | null
  onChange: (date: DateParts | null) => void
}

function labelFor(kind: PlanningFieldProps['kind']): string {
  return kind === 'scheduled' ? 'S' : 'D'
}

function titleFor(kind: PlanningFieldProps['kind']): string {
  return kind === 'scheduled' ? 'SCHEDULED' : 'DEADLINE'
}

export function PlanningField({
  kind,
  value,
  display,
  onChange,
}: PlanningFieldProps) {
  const inputValue = datePartsToInput(value)
  const danger = kind === 'deadline'

  return (
    <div className={`planning-field${danger ? ' danger' : ''}`}>
      <span className="planning-label" title={titleFor(kind)}>
        {labelFor(kind)}
      </span>
      <input
        type="date"
        className="planning-date"
        value={inputValue}
        aria-label={`${titleFor(kind)} date`}
        title={display ? `${titleFor(kind)}: ${display}` : `Set ${titleFor(kind)}`}
        onChange={(e) => {
          const next = datePartsFromInput(e.target.value)
          onChange(next)
        }}
      />
      {!value ? (
        <button
          type="button"
          className="planning-quick"
          title={`Set ${titleFor(kind)} to today`}
          onClick={() => onChange(todayParts())}
        >
          today
        </button>
      ) : (
        <button
          type="button"
          className="planning-clear"
          title={`Clear ${titleFor(kind)}`}
          aria-label={`Clear ${titleFor(kind)}`}
          onClick={() => onChange(null)}
        >
          ×
        </button>
      )}
    </div>
  )
}

interface PlanningEditorProps {
  scheduled: DateParts | null
  deadline: DateParts | null
  scheduledDisplay: string | null
  deadlineDisplay: string | null
  onSetScheduled: (date: DateParts | null) => void
  onSetDeadline: (date: DateParts | null) => void
}

export function PlanningEditor({
  scheduled,
  deadline,
  scheduledDisplay,
  deadlineDisplay,
  onSetScheduled,
  onSetDeadline,
}: PlanningEditorProps) {
  return (
    <div className="planning-editor" aria-label="Schedule and deadline">
      <PlanningField
        kind="scheduled"
        value={scheduled}
        display={scheduledDisplay}
        onChange={onSetScheduled}
      />
      <PlanningField
        kind="deadline"
        value={deadline}
        display={deadlineDisplay}
        onChange={onSetDeadline}
      />
    </div>
  )
}
