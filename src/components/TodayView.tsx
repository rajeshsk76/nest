import { collectTodayAgenda, type TodayItem } from '../lib/org'

interface TodayViewProps {
  files: Array<{ id: string; source: string }>
  onMarkDone: (fileId: string, path: number[]) => void
}

function reasonLabel(reason: TodayItem['reason']): string {
  if (reason === 'deadline') return 'DEADLINE'
  if (reason === 'scheduled') return 'SCHEDULED'
  return 'TODO'
}

export function TodayView({ files, onMarkDone }: TodayViewProps) {
  const items = collectTodayAgenda(files)
  const stamped = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <section className="today">
      <header className="panel-header">
        <div>
          <h2>Today</h2>
          <p className="muted">{stamped}</p>
        </div>
        <p className="muted small">
          Open TODOs plus items SCHEDULED or DEADLINE for today. Marking DONE
          writes back into the .org source.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="empty">Nothing for today. Enjoy the quiet.</p>
      ) : (
        <ul className="today-list">
          {items.map((item) => (
            <li key={item.id} className="today-item">
              <div className="today-main">
                <span className={`reason reason-${item.reason}`}>
                  {reasonLabel(item.reason)}
                </span>
                <span className="today-title">{item.title}</span>
                <span className="muted small">{item.fileId}.org</span>
              </div>
              <div className="today-actions">
                {item.scheduled && (
                  <span className="chip">S {item.scheduled}</span>
                )}
                {item.deadline && (
                  <span className="chip danger">D {item.deadline}</span>
                )}
                {item.todo === 'TODO' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onMarkDone(item.fileId, item.path)}
                  >
                    Mark DONE
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
