import { useState, type ReactNode } from 'react'
import type { explainImpact, suggestDecisionLink } from '../server/analysis/service.ts'

type Evidence = { id: string; title: string; body: string }
type Impact = { analysis: Awaited<ReturnType<typeof explainImpact>>; evidence: Evidence[] }
type DecisionLinks = { analyses: Awaited<ReturnType<typeof suggestDecisionLink>>[]; evidence: Evidence[] }

async function loadSample<T>(path: string): Promise<T> {
  const response = await fetch(`/api/demo/analysis/profile/${path}`)
  if (!response.ok) throw new Error('Sample analysis is unavailable.')
  return response.json() as Promise<T>
}

function ReviewCard({ title, evidence, children }: { title: string; evidence: Evidence[]; children: ReactNode }) {
  const [review, setReview] = useState('Needs review')
  return (
    <article className="insight-card task-demo-card">
      <h3>{title}</h3>
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

export function TaskAnalysisDemo() {
  const [task, setTask] = useState('')
  const [impact, setImpact] = useState<Impact | null>(null)
  const [links, setLinks] = useState<DecisionLinks | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function runSample(path: 'impact' | 'decision-links') {
    setBusy(true)
    setError(false)
    try {
      if (path === 'impact') setImpact(await loadSample<Impact>(path))
      else setLinks(await loadSample<DecisionLinks>(path))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function reset(nextTask = '') {
    setTask(nextTask)
    setImpact(null)
    setLinks(null)
    setError(false)
  }

  const impactResult = impact?.analysis.result

  return (
    <section className="catchup-controls task-demo" aria-labelledby="task-demo-title">
      <div className="controls-heading">
        <div>
          <h2 id="task-demo-title">Task-aware sample demo</h2>
          <p>Scripted analysis using sample Slack and GitHub evidence.</p>
        </div>
      </div>
      <div className="task-demo-actions">
        <label htmlFor="task-demo-select">Assigned task</label>
        <select id="task-demo-select" value={task} disabled={busy} onChange={(event) => reset(event.target.value)}>
          <option value="">Choose a task</option>
          <option value="FE-12">Profile Settings</option>
        </select>
        <button type="button" className="filter-button" disabled={busy || !task} onClick={() => reset()}>Reset demo</button>
      </div>

      {task && (
        <>
          <p>ProfileSettings uses <code>GET /users/:id</code>.</p>
          <div className="task-demo-actions">
            <button type="button" className="primary-button" disabled={busy} onClick={() => runSample('decision-links')}>
              Run task catch-up
            </button>
          </div>
        </>
      )}

      {links && (
        <div className="task-demo-actions">
          <span>Relevant change · Open PR #18</span>
          <button type="button" className="filter-button" disabled={busy} onClick={() => runSample('impact')}>Explain PR impact</button>
        </div>
      )}
      {busy && <p role="status">Preparing sample analysis…</p>}
      {error && <p className="error-message" role="alert">Could not load the sample analysis. Check that the local API is running and try again.</p>}

      {impact && impactResult?.status === 'suggested' && (
        <ReviewCard title="PR impact suggestion" evidence={impact.evidence.filter((item) => impactResult.suggestion.evidenceIds.includes(item.id))}>
          <p>{impactResult.suggestion.summary}</p>
          <p><strong>Next action.</strong> {impactResult.suggestion.nextAction}</p>
        </ReviewCard>
      )}
      {impact && impactResult?.status !== 'suggested' && <p role="status">Impact uncertain. Inspect the sample PR before acting.</p>}

      {links?.analyses.map(({ decisionStatus, result }) => {
        if (result.status !== 'suggested') return <p key={decisionStatus}>No supported Slack link for this sample.</p>
        const title = decisionStatus === 'confirmed' ? 'Slack decision link' : 'Possible Slack discussion link'
        return (
          <ReviewCard key={decisionStatus} title={title} evidence={links.evidence.filter((item) => result.suggestion.evidenceIds.includes(item.id))}>
            <p>Slack decision status · {decisionStatus}</p>
            <p>{result.suggestion.summary}</p>
          </ReviewCard>
        )
      })}
    </section>
  )
}
