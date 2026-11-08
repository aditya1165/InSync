import { useEffect, useState } from 'react'
import { reviewLink, type DemoSource, type LinkReview, type PaginationCatchUp, type SlackEventStatus } from './lib/real-demo.ts'
function localDate(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
function Source({ record }: { record: DemoSource }) {
  return <details className="pagination-source"><summary>{record.title}</summary>
    <p><code>{record.id}</code> · <time>{new Date(record.timestamp).toLocaleString()}</time></p>
    <pre>{record.body}</pre>{record.url && <a href={record.url} target="_blank" rel="noreferrer">Open original source ↗</a>}
  </details>
}
export function PaginationDemo() {
  const [mode, setMode] = useState<'live' | 'human' | 'sample'>('live')
  const [start, setStart] = useState(() => localDate(new Date(Date.now() - 7 * 86400000)))
  const [end, setEnd] = useState(() => localDate(new Date()))
  const [throughNow, setThroughNow] = useState(true)
  const [result, setResult] = useState<PaginationCatchUp | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [why, setWhy] = useState(false)
  const [review, setReview] = useState<LinkReview>({ state: 'pending' })
  const [correctedId, setCorrectedId] = useState('')
  const [threadTs, setThreadTs] = useState('')
  const [events, setEvents] = useState<SlackEventStatus | null>(null)
  const [eventsError, setEventsError] = useState('')
  useEffect(() => {
    let active = true; let fetching = false
    async function refresh() {
      if (fetching) return
      fetching = true
      try {
        const response = await fetch('/api/slack-events/status')
        const data = await response.json()
        if (!response.ok) throw new Error('Event status is unavailable outside the local demo.')
        if (!active) return
        setEvents(data); setEventsError('')
        setThreadTs((current) => data.threads.some((t: { threadTs: string }) => t.threadTs === current) ? current : data.threads[0]?.threadTs || '')
      } catch { if (active) setEventsError('Could not refresh Slack listener status. Check the local backend.') }
      finally { fetching = false }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const loadedThread = events?.threads.find((t) => t.threadTs === result?.slackThreadTs)
  const stale = !!result?.slackThreadTs && (!!eventsError || events?.state !== 'connected' || !loadedThread || loadedThread.revision !== result.slackThreadRevision)
  useEffect(() => { if (stale) setReview({ state: 'pending' }) }, [stale])
  async function catchUp() {
    setLoading(true); setError(''); setResult(null); setWhy(false); setReview({ state: 'pending' })
    try {
      const endTime = throughNow ? new Date() : new Date(end)
      if (!start || !end || new Date(start) >= endTime) throw new Error('Choose an absence start before its end.')
      if (mode === 'human' && !threadTs) throw new Error('Start the listener, then post a new human discussion in the approved Slack channel.')
      const params = new URLSearchParams({ mode: mode === 'human' ? 'live' : mode, start: new Date(start).toISOString(), end: endTime.toISOString() })
      if (mode === 'human') params.set('threadTs', threadTs)
      const response = await fetch(`/api/real-demo/catch-up?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load source evidence.')
      if (throughNow) setEnd(localDate(endTime))
      setResult(data); setCorrectedId(data.messages[0]?.id || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Catch-up unavailable.') }
    finally { setLoading(false) }
  }
  function applyReview(value: LinkReview) {
    if (result && !stale) setReview(reviewLink(value, result.messages))
  }
  return <section className="pagination-demo" aria-labelledby="pagination-title">
    <div className="controls-heading"><div><h2 id="pagination-title">Back on Track · Leo’s ProductList</h2>
      <p>Simulated Monday: Leo returns after a week away. Follow the pagination change from discussion to PR.</p></div></div>
    <p className="analysis-notice">Staged story; weekdays are simulated. Live mode displays actual platform timestamps. Analysis uses inspectable contract rules, not a model.</p>
    <div className="pagination-controls">
      <label>Data source<select value={mode} onChange={(e) => { setMode(e.target.value as 'live' | 'human' | 'sample'); setResult(null); setError('') }}>
        <option value="live">Seeded GitHub + Slack records</option><option value="human">Human Slack discussions (live events)</option><option value="sample">Scripted pagination sample (offline)</option>
      </select></label>
      {mode === 'human' && <label>Collected human discussion<select value={threadTs} onChange={(e) => { setThreadTs(e.target.value); setResult(null) }}>
        {!events?.threads.length && <option value="">Waiting for a new human message…</option>}
        {events?.threads.map((t) => <option key={t.threadTs} value={t.threadTs}>Thread {new Date(Number(t.threadTs) * 1000).toLocaleString()} · {t.eventCount} events</option>)}
      </select></label>}
      <label>Absent since<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label>Catch up through<input type="datetime-local" value={end} disabled={throughNow} onChange={(e) => setEnd(e.target.value)} /></label>
      <label className="pagination-now"><input type="checkbox" checked={throughNow} onChange={(e) => setThroughNow(e.target.checked)} />Through current time</label>
      <button className="primary-button" onClick={catchUp} disabled={loading}>{loading ? 'Loading source evidence…' : 'Catch me up'}</button>
    </div>
    {mode === 'human' && <div className="analysis-notice" role="status">
      <p><strong>Slack listener: {events?.state || 'checking'}</strong> · {events?.threads.length || 0} human threads collected.</p>
      <p>{eventsError || events?.detail}</p>
      <p>Post as yourself in the approved channel after the listener connects. Bot posts are excluded. The list refreshes every 5 seconds; Catch me up fetches the thread and the existing pagination PR.</p>
      {events?.connectedAt && <p>Connected: {new Date(events.connectedAt).toLocaleString()} · Channel: {events.channelId}</p>}
      <p>{events?.retention}</p>
    </div>}
    {error && <p role="alert" className="error-message">{error} The offline sample is available in the data source selector.</p>}
    {result && <div aria-live="polite">
      {stale && <p role="alert" className="error-message">This loaded discussion may have changed or the listener is offline. Run Catch me up again before reviewing the relationship.</p>}
      <p className="mode-pill">{result.mode === 'live' ? result.slackSource === 'human_events' ? 'Real human Slack discussion + demo GitHub PR' : 'Real GitHub + Slack records · staged content' : 'Scripted sample · no remote objects'}</p>
      {!result.inWindow ? <p>No matching PR or selected discussion activity in the absence window. Adjust the dates; the PR timestamp is: {new Date(result.pr.timestamp).toLocaleString()}.</p> : <article className="pagination-impact">
        <h3>{result.impact === 'breaking' ? 'Potential breaking contract change' : 'Impact uncertain'} · ProductList</h3>
        <p><strong>{result.pr.title}</strong> · PR #{result.pr.number} · {result.pr.lifecycle}</p>
        <p>{result.explanation}</p>
        <ol>{result.actions.map((action) => <li key={action}>{action}</li>)}</ol>
        {result.pr.url && <p><a href={result.pr.url} target="_blank" rel="noreferrer">Inspect actual PR ↗</a></p>}
        <details><summary>Inspect code and API contract evidence</summary>{result.code.map((r) => <Source key={r.id} record={r} />)}</details>
        <button className="primary-button" aria-expanded={why} onClick={() => setWhy(!why)}>Why did this change?</button>
        {why && <section className="pagination-provenance" aria-label="Decision-to-PR provenance">
          <h3>{result.decision.id} → PR #{result.pr.number} → ProductList</h3>
          <p>Source decision status: <strong>{result.decision.status}</strong>. Link review: <strong>{review.state}</strong>.</p>
          <p>{review.state === 'confirmed' ? 'You confirmed this Slack-to-PR relationship.' : review.state === 'rejected' ? 'You rejected this relationship; it is not verified.' : review.state === 'corrected' ? 'You selected a replacement Slack source for this relationship.' : 'Possible match — not verified'}</p>
          <p>{result.link.rationale}</p>
          <p>Relationship evidence: {result.link.evidenceIds.join(' · ')}</p>
          {result.messages.map((r) => <Source key={r.id} record={r} />)}
          <fieldset disabled={stale} className="pagination-review"><legend>Review Slack-to-PR relationship</legend><div className="pagination-controls" role="group" aria-label="Review Slack-to-PR relationship">
            <button onClick={() => applyReview({ state: 'confirmed' })}>Confirm link</button>
            <button onClick={() => applyReview({ state: 'rejected' })}>Not Relevant / Reject</button>
            <button onClick={() => applyReview({ state: 'deferred' })}>Remind Later</button>
            <button onClick={() => applyReview({ state: 'pending' })}>Undo / Reopen</button>
          </div>
          <label>Correct the linked source<select value={correctedId} onChange={(e) => setCorrectedId(e.target.value)}>
            {result.messages.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.id}</option>)}
          </select></label>
          <button disabled={!correctedId} onClick={() => applyReview({ state: 'corrected', correctedMessageId: correctedId })}>Use selected source</button>
          {review.state === 'corrected' && <p>Corrected relationship source: {review.correctedMessageId}</p>}</fieldset>
          <p>Review is local to this loaded result. It does not change the Slack decision or PR.</p>
        </section>}
        <ul>{result.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>}
    </div>}
  </section>
}
