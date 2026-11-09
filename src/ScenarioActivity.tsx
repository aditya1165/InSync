import { useState } from 'react'
import { Review, Source } from './PaginationDemo.tsx'
import { scenarioRecords } from './lib/walkthrough.ts'
import type { Walkthrough } from './useWalkthrough.ts'
export function ScenarioActivity({ walkthrough: w, onTask }: { walkthrough: Walkthrough; onTask: () => void }) {
  const [filter, setFilter] = useState<'all' | 'github' | 'slack'>('all')
  if (!w.result) return <section className="welcome-panel"><div><h2>No scenario evidence loaded</h2><p>Select a task and click Catch me up in My work. The same evidence and relationship review will appear here.</p><button className="primary-button" onClick={onTask}>Open My work →</button></div></section>
  const result = w.result
  const records = scenarioRecords(result, filter)
  return <section className="pagination-demo" aria-label="Selected scenario evidence">
    <div className="database-task-heading"><div><h2>Selected scenario’s evidence</h2><p>{result.mode === 'sample' ? 'Offline pagination sample · simulated records and dates' : `Retrieved PR #${result.pr.number} + ${result.decision.id} discussion · actual source timestamps`}</p></div><button onClick={w.reset}>Reset walkthrough</button></div>
    <p>This feed covers the selected scenario, using the same retrieved snapshot as My work.</p>
    <button className="cyan-btn-secondary" onClick={onTask}>Back to {result.mode === 'sample' ? 'sample ProductList' : w.selectedTask?.title || result.task.component} →</button>
    {result.window && <p className="session-note">Window: {new Date(result.window.start).toLocaleString()} → {new Date(result.window.end).toLocaleString()} (end excluded).</p>}
    <p>PR lifecycle: <strong>{result.pr.lifecycle}</strong>. Deployment unverified. Analysis uses evidence-based rules.</p>
    {w.stale && <p role="alert" className="error-message">An observed update changed this discussion. Catch up again in My work before reviewing.</p>}
    <Review walkthrough={w} />
    <div className="task-source-switch" role="group" aria-label="Scenario source filter">{(['all', 'github', 'slack'] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All sources' : value === 'github' ? 'GitHub' : 'Slack'}</button>)}</div>
    {records.length ? records.map((r) => <article className="scenario-feed-item" key={r.id}>
      <p className="mode-pill">{r.provider === 'github' ? 'GitHub PR' : 'Slack message'}{r.actorId ? ` · ${r.actorId}` : ''}</p>
      <p><time dateTime={r.timestamp}>{new Date(r.timestamp).toLocaleString()}</time></p>
      {r.provider === 'github' && result.pr.createdAt && <p className="session-note">Created: {new Date(result.pr.createdAt).toLocaleString()}{result.pr.updatedAt && <> · Updated: {new Date(result.pr.updatedAt).toLocaleString()}</>}</p>}
      <p>{r.body}</p><Source record={r} />
    </article>) : <p>No records from this source in the loaded window.</p>}
    <p className="session-note">Only events in the selected window appear in this feed. Older source context remains inspectable in My work.</p>
  </section>
}
