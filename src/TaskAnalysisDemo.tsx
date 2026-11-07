import { useState, type ReactNode } from 'react'
import { loadTaskCatchUp, type Evidence } from './lib/task-demo.ts'

function ReviewCard({ title, evidence, children }: { title: string; evidence: Evidence[]; children?: ReactNode }) {
  const [review, setReview] = useState('Needs review')
  return (
    <article className="insight-card task-demo-card">
      <h4>{title}</h4>
      {children}
      {evidence.map((item) => (
        <details key={item.id}>
          <summary>{item.title}</summary>
          <pre>{item.body}</pre>
        </details>
      ))}
      <div className="task-demo-actions" role="group" aria-label={`Review ${title}`}>
        {['Confirm', 'Not Relevant', 'Remind Later'].map((action) => (
          <button className="filter-button" key={action} type="button" aria-pressed={review === action} onClick={() => setReview(action)}>
            {action}
          </button>
        ))}
        {review !== 'Needs review' && (
          <button className="filter-button" type="button" onClick={() => setReview('Needs review')}>Undo review</button>
        )}
      </div>
      <p role="status">Review status · {review}</p>
    </article>
  )
}

type Updates = Awaited<ReturnType<typeof loadTaskCatchUp>>

export function TaskAnalysisDemo() {
  const [filter, setFilter] = useState('')
  const [updates, setUpdates] = useState<Updates | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function runCatchUp() {
    setBusy(true)
    setError(false)
    try {
      setUpdates(await loadTaskCatchUp())
      setFilter('')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setUpdates(null)
    setFilter('')
    setError(false)
  }

  const tasks = new Map(updates?.map(({ task }) => [task.id, task.name]))
  const visibleCount = updates?.filter(({ task }) => !filter || task.id === filter).length

  return (
    <section className="catchup-controls task-demo" aria-labelledby="task-demo-title">
      <div className="controls-heading">
        <div>
          <h2 id="task-demo-title">Catch up on your assigned work</h2>
          <p>See GitHub changes that may affect your tasks and the related Slack discussions.</p>
          <p><strong>Scripted sample</strong> · Uses predefined tasks and sample records.</p>
        </div>
      </div>
      <div className="task-demo-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={runCatchUp}>
          {busy ? 'Preparing catch-up…' : 'Catch Me Up'}
        </button>
        {updates && <button type="button" className="filter-button" disabled={busy} onClick={reset}>Reset demo</button>}
      </div>
      {busy && <p role="status">Checking sample changes against your assigned tasks…</p>}
      {error && <p className="error-message" role="alert">Could not load the sample catch-up. Check that the local API is running and try again.</p>}

      {updates && (
        <section className="task-demo-interaction" aria-labelledby="task-demo-updates">
          <h3 id="task-demo-updates">Prioritized updates</h3>
          <div className="task-demo-actions">
            <label htmlFor="task-demo-filter">Filter by task</label>
            <select id="task-demo-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All my tasks</option>
              {[...tasks].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <p role="status">{visibleCount === 0 ? 'No relevant updates for this view.' : `${visibleCount} task-related ${visibleCount === 1 ? 'update' : 'updates'}`}</p>
          {updates.map(({ prNumber, title, lifecycle, task, change, priorityReason, impact, links }) => {
            const result = impact.analysis.result
            const discussions = links.analyses.flatMap(({ result }) => result.status === 'suggested'
              ? links.evidence.filter((item) => item.title.startsWith('Slack sample · ') && result.suggestion.evidenceIds.includes(item.id))
              : [])
            return (
              <article className="insight-card task-demo-card" key={prNumber} hidden={Boolean(filter && task.id !== filter)} aria-labelledby={`task-demo-pr-${prNumber}`}>
                <div className="insight-card-header">
                  <h3 id={`task-demo-pr-${prNumber}`}>PR #{prNumber} · {title}</h3>
                  <span className="status-pill">{lifecycle === 'open' ? 'Open' : 'Draft'}</span>
                </div>
                <p><strong>Assigned task.</strong> {task.name}</p>
                <p>{change}</p>
                <p><strong>Why it’s prioritized.</strong> {priorityReason}</p>
                {result.status === 'suggested' ? (
                  <>
                    <p><strong>Task impact.</strong> {result.suggestion.summary}</p>
                    <p><strong>Next action.</strong> {result.suggestion.nextAction}</p>
                  </>
                ) : <p>Task impact is uncertain.</p>}
                {discussions.length > 0 && (
                  <p><strong>Related Slack.</strong> {discussions.map(({ title }) => title.replace('Slack sample · ', '')).join(' · ')}</p>
                )}

                <details className="task-demo-interaction">
                  <summary><strong>1. Task impact and GitHub evidence</strong></summary>
                  <p>{task.name} uses <code>{task.endpoint}</code>.</p>
                  {result.status === 'suggested' ? (
                    <ReviewCard title="PR impact suggestion" evidence={impact.evidence.filter((item) => result.suggestion.evidenceIds.includes(item.id))} />
                  ) : <p>Impact uncertain. Inspect the available sample evidence before acting.</p>}
                </details>

                <details className="task-demo-interaction">
                  <summary><strong>2. Related Slack discussions and decisions</strong></summary>
                  {links.analyses.map(({ decisionStatus, result }) => {
                    if (result.status !== 'suggested') return <p key={decisionStatus}>No supported Slack link for this sample.</p>
                    const title = decisionStatus === 'confirmed' ? 'Confirmed Slack decision' : 'Unresolved Slack discussion'
                    return (
                      <ReviewCard key={decisionStatus} title={title} evidence={links.evidence.filter((item) => result.suggestion.evidenceIds.includes(item.id))}>
                        <p>{result.suggestion.summary}</p>
                      </ReviewCard>
                    )
                  })}
                </details>
              </article>
            )
          })}
        </section>
      )}
    </section>
  )
}
