import type { DemoSource } from './lib/real-demo.ts'
import { localDate, type Walkthrough } from './useWalkthrough.ts'
export function Source({ record }: { record: DemoSource }) {
  return <details className="pagination-source"><summary>{record.title}</summary>
    <p><code>{record.id}</code> · <time dateTime={record.timestamp}>{new Date(record.timestamp).toLocaleString()}</time>{record.actorId && <> · Actor: {record.actorId}</>}</p>
    <pre>{record.body}</pre>{record.url && <a href={record.url} target="_blank" rel="noreferrer">Open original source ↗</a>}
  </details>
}
export function Review({ walkthrough: w }: { walkthrough: Walkthrough }) {
  const { result, review } = w
  if (!result) return null
  return <>
    <p>Source decision status: <strong>{result.decision.status}</strong>. Your relationship review: <strong>{review.state}</strong>.</p>
    <p>{review.state === 'confirmed' ? 'You confirmed this Slack-to-PR relationship.' : review.state === 'rejected' ? 'You rejected this relationship; it is not verified.' : review.state === 'corrected' ? `Replacement source: ${review.correctedMessageId}` : review.state === 'deferred' ? 'Remind Later: deferred for this session; no notification is scheduled.' : 'Possible match — not verified'}</p>
    <fieldset disabled={w.stale || !result.inWindow} className="pagination-review"><legend>Review Slack-to-PR relationship</legend><div className="pagination-controls" role="group" aria-label="Review Slack-to-PR relationship">
      <button onClick={() => w.applyReview({ state: 'confirmed' })}>Confirm link</button>
      <button onClick={() => w.applyReview({ state: 'rejected' })}>Not Relevant / Reject</button>
      <button onClick={() => w.applyReview({ state: 'deferred' })}>Remind Later</button>
      <button onClick={() => w.applyReview({ state: 'pending' })}>Undo / Reopen</button>
    </div>
    <label>Correct the linked source<select value={w.correctedId} onChange={(e) => w.setCorrectedId(e.target.value)}>{result.messages.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.id}</option>)}</select></label>
    <button disabled={!w.correctedId} onClick={() => w.applyReview({ state: 'corrected', correctedMessageId: w.correctedId })}>Use selected source</button></fieldset>
    <p className="session-note">Review is shared across both views for this session. It does not change the source decision, PR or task.</p>
  </>
}
export function PaginationDemo({ walkthrough: w, onTeamActivity }: { walkthrough: Walkthrough; onTeamActivity: () => void }) {
  const { result } = w
  return <section className="pagination-demo" aria-labelledby="pagination-title">
    <div className="database-task-heading"><div><h2 id="pagination-title">Catch up on {w.mode === 'sample' ? 'sample ProductList' : w.selectedTask?.component || 'your task'}</h2><p>Inspect the change, then trace its discussion and review the suggested connection.</p></div><button type="button" onClick={w.reset}>Reset walkthrough</button></div>
    <p className="analysis-notice">Analysis uses evidence-based contract rules. Real mode fetches current GitHub and Slack records; the example scenario is staged. PR status does not establish deployment.</p>
    <div className="pagination-controls">
      <label>Scenario evidence<select value={w.mode} onChange={(e) => w.chooseMode(e.target.value as Walkthrough['mode'])}>
        <option value="replay">Saved human DEC-15 discussion + PR</option><option value="human">New human discussion (live events)</option><option value="seeded">Seeded bot discussion + PR</option><option value="sample">Offline pagination sample · simulated</option>
      </select></label>
      {w.mode === 'replay' && <label className="pagination-now"><input type="checkbox" checked={w.useSavedWindow} onChange={(e) => w.setUseSavedWindow(e.target.checked)} />Use saved scenario window</label>}
      {w.mode === 'human' && <label>Collected discussion<select value={w.threadTs} onChange={(e) => { w.reset(); w.setThreadTs(e.target.value) }}><option value="">Choose a human thread</option>{w.events?.threads.map((t) => <option key={t.threadTs} value={t.threadTs}>{new Date(Number(t.threadTs) * 1000).toLocaleString()}</option>)}</select></label>}
      <label>Absent since<input type="datetime-local" disabled={w.mode === 'replay' && w.useSavedWindow} value={w.mode === 'replay' && w.useSavedWindow && w.replay ? localDate(new Date(w.replay.window.start)) : w.start} onChange={(e) => w.setStart(e.target.value)} /></label>
      <label>Catch up through<input type="datetime-local" disabled={w.throughNow || (w.mode === 'replay' && w.useSavedWindow)} value={w.mode === 'replay' && w.useSavedWindow && w.replay ? localDate(new Date(w.replay.window.end)) : w.end} onChange={(e) => w.setEnd(e.target.value)} /></label>
      {!(w.mode === 'replay' && w.useSavedWindow) && <label className="pagination-now"><input type="checkbox" checked={w.throughNow} onChange={(e) => w.setThroughNow(e.target.checked)} />Through current time</label>}
      <button className="primary-button" onClick={() => { void w.catchUp() }} disabled={w.loading || (w.mode !== 'sample' && !w.selectedTask) || (w.mode === 'replay' && w.useSavedWindow && !w.replay)}>{w.loading ? 'Loading source evidence…' : 'Catch me up'}</button>
    </div>
    {w.mode === 'replay' && <p className="session-note">{w.replay ? `Pinned ${w.replay.decisionId} · PR #${w.replay.prNumber}. Each walkthrough fetches these records again. No new post or push is needed.` : w.replayError || 'Select an assigned task to load saved scenario settings.'}</p>}
    {w.mode === 'human' && <p role="status">Slack listener: {w.events?.state || 'checking'}. {w.events?.detail}</p>}
    {w.mode === 'sample' && <p className="analysis-notice">Offline sample assignment: ProductList → GET /products → totalPages. All records and relative dates below are simulated; no Supabase assignment or remote source access is implied.</p>}
    {w.error && <p role="alert" className="error-message">{w.error} Select the labeled offline sample if needed.</p>}
    {result && <div aria-live="polite">
      {w.stale && <p role="alert" className="error-message">An observed Slack event changed this discussion. Catch up again before reviewing.</p>}
      <p className="mode-pill">{result.mode === 'sample' ? 'Offline sample · simulated records and timestamps' : result.slackSource === 'seeded' ? 'Real records · staged bot discussion' : 'Real human Slack discussion + demo GitHub PR'} · Evidence snapshot</p>
      {!result.inWindow ? <p>No matching PR or discussion activity in this window. Adjust the dates or use the saved scenario window.</p> : <article className="pagination-impact">
        <h3>{result.impact === 'breaking' ? 'Potential breaking contract change' : 'Impact uncertain'} · {result.task.component}</h3>
        <p><strong>{result.pr.title}</strong> · PR #{result.pr.number} · {result.pr.lifecycle}</p><p>{result.explanation}</p>
        <ol>{result.actions.map((action) => <li key={action}>{action}</li>)}</ol>
        <details><summary>Impact evidence IDs</summary><p>{result.impactEvidenceIds?.join(' · ')}</p></details>
        <Source record={result.pr} />
        <details><summary>Inspect code and API contract evidence</summary>{result.code.map((r) => <Source key={r.id} record={r} />)}</details>
        <button className="primary-button" aria-expanded={w.why} onClick={w.toggleWhy}>Why did this change?</button>
        {w.why && <section className="pagination-provenance" aria-label="Decision-to-PR provenance"><h3>{result.decision.id} → PR #{result.pr.number}</h3><p>{result.link.rationale}</p><p>Relationship evidence: {result.link.evidenceIds.join(' · ')}</p>{result.messages.map((r) => <Source key={r.id} record={r} />)}<Review walkthrough={w} /></section>}
        <ul>{result.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>}
      <button type="button" className="cyan-btn-secondary" onClick={onTeamActivity}>View scenario evidence in Team activity →</button>
      <p className="session-note">Fetched at {new Date(result.retrievedAt || '').toLocaleTimeString()}. Evidence is refreshed on Catch me up, not continuously.</p>
    </div>}
  </section>
}
