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
          <h2 id="task-demo-title">Try the two sample interactions</h2>
          <p>Start with your assigned frontend task. This demo uses scripted Slack and GitHub samples.</p>
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
          <p>Profile Settings reads <code>user_name</code> from <code>GET /users/:id</code>.</p>
          <article className="insight-card task-demo-card" aria-labelledby="task-demo-pr">
            <div className="insight-card-header">
              <h3 id="task-demo-pr">PR #18 · Add display_name to profile response</h3>
              <span className="status-pill">Open</span>
            </div>
            <p>Relevant GitHub sample</p>
            <p>The proposed API response adds <code>display_name</code> and keeps <code>user_name</code>.</p>
          </article>

          {busy && <p role="status">Preparing sample analysis…</p>}
          {error && <p className="error-message" role="alert">Could not load the sample analysis. Check that the local API is running and try again.</p>}

          <section className="task-demo-interaction" aria-labelledby="task-demo-impact">
            <h3 id="task-demo-impact">1. How does this change affect my task?</h3>
            <button type="button" className="primary-button" disabled={busy} onClick={() => runSample('impact')}>
              Explain impact on Profile Settings
            </button>
            {impact && impactResult?.status === 'suggested' && (
              <ReviewCard title="PR impact suggestion" evidence={impact.evidence.filter((item) => impactResult.suggestion.evidenceIds.includes(item.id))}>
                <p>{impactResult.suggestion.summary}</p>
                <p><strong>Next action.</strong> {impactResult.suggestion.nextAction}</p>
              </ReviewCard>
            )}
            {impact && impactResult?.status !== 'suggested' && <p role="status">Impact uncertain. Inspect the sample PR before acting.</p>}
          </section>

          <section className="task-demo-interaction" aria-labelledby="task-demo-decisions">
            <h3 id="task-demo-decisions">2. What did the team discuss about this change?</h3>
            <button type="button" className="filter-button" disabled={busy} onClick={() => runSample('decision-links')}>
              Show related Slack discussions
            </button>
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
        </>
      )}
    </section>
  )
}
