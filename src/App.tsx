import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { TaskAnalysisDemo } from './TaskAnalysisDemo.tsx'
import { PaginationDemo } from './PaginationDemo.tsx'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  ExternalLink,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  Info,
  ListFilter,
  MessageCircle,
  MessageSquareText,
  Moon,
  RefreshCw,
  SearchCheck,
  Sparkles,
  Sun,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import {
  createCatchUp,
  type Activity,
  type ActivityKind,
  type ActivitySource,
  type CatchUpResult,
  type Insight,
  type InsightCategory,
} from './lib/catchup.ts'
import { createDemoProvider, demoAnalyzer } from './lib/demo.ts'
import { getTimeWindow, previousCalendarWeek, type RangeChoice } from './lib/time.ts'

const locale = navigator.language || 'en-US'

const rangeOptions: { id: RangeChoice; title: string; description: string; icon: LucideIcon }[] = [
  {
    id: 'last24Hours',
    title: 'Last 24 hours',
    description: 'A rolling day of updates',
    icon: Clock3,
  },
  {
    id: 'previousWeek',
    title: 'Last week',
    description: 'Previous calendar week',
    icon: CalendarDays,
  },
  {
    id: 'sinceLastCatchUp',
    title: 'Since last catch-up',
    description: 'From your last successful summary',
    icon: RefreshCw,
  },
]

const insightSections: {
  id: InsightCategory
  title: string
  note: string
  icon: LucideIcon
}[] = [
  {
    id: 'possible_decision',
    title: 'Possible decisions',
    note: 'Discussion that may lead to a decision; not yet verified',
    icon: MessageSquareText,
  },
  {
    id: 'unresolved',
    title: 'Unresolved discussions',
    note: 'Questions and blockers that still need an answer',
    icon: CircleAlert,
  },
  {
    id: 'code_change',
    title: 'Code changes',
    note: 'Pull requests and commits, with their current state',
    icon: Code2,
  },
  {
    id: 'next_action',
    title: 'Suggested next actions',
    note: 'Ideas to verify before acting',
    icon: SearchCheck,
  },
]

const kindLabels: Record<ActivityKind, { label: string; icon: LucideIcon }> = {
  slack_message: { label: 'Message', icon: MessageCircle },
  slack_thread: { label: 'Thread', icon: MessageSquareText },
  github_issue: { label: 'Issue', icon: Ticket },
  github_pull_request: { label: 'Pull request', icon: GitPullRequest },
  github_commit: { label: 'Commit', icon: GitCommitHorizontal },
  github_issue_comment: { label: 'Issue comment', icon: MessageCircle },
  github_review_comment: { label: 'Review comment', icon: FileCode2 },
}

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

function getRangeDescription(choice: RangeChoice, now: Date, lastCompletedAt: Date | null) {
  if (choice === 'previousWeek') {
    const { start, end } = previousCalendarWeek(now, locale)
    return `${formatDate(start)} – ${formatDate(new Date(end.getTime() - 1))}`
  }
  if (choice === 'sinceLastCatchUp') {
    return lastCompletedAt ? `After ${formatDateTime(lastCompletedAt)}` : 'Run your first catch-up to use this range'
  }
  return `Since ${formatDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000))}`
}

function formatResultRange(result: CatchUpResult) {
  return `${formatDateTime(result.window.start)} – ${formatDateTime(result.window.end)}`
}

function SourceMark({ source }: { source: ActivitySource }) {
  return (
    <span className={`source-mark source-mark--${source}`} aria-label={source === 'slack' ? 'Slack' : 'GitHub'}>
      {source === 'slack' ? <MessageCircle size={16} strokeWidth={2.3} /> : <Code2 size={17} strokeWidth={2.2} />}
    </span>
  )
}

function SourceDetail({ activity, mode, onClose }: { activity: Activity; mode: CatchUpResult['mode']; onClose: () => void }) {
  const { icon: KindIcon, label } = kindLabels[activity.kind]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        className="source-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-topline">
          <div className="dialog-source"><SourceMark source={activity.source} /> {activity.source === 'slack' ? 'Slack' : 'GitHub'} {mode === 'demo' ? 'sample' : 'source'}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close source detail">×</button>
        </div>
        <div className="source-detail-kind"><KindIcon size={15} /> {label}</div>
        <h2 id="source-dialog-title">{activity.title}</h2>
        <div className="source-detail-meta">
          <span>{activity.actor}</span><span aria-hidden="true">·</span><span>{formatDateTime(activity.occurredAt)}</span>
        </div>
        <p className="source-detail-location">{activity.location}</p>
        <div className="source-detail-body">{activity.body}</div>
        {mode === 'demo' && <div className="dialog-note"><Info size={16} /> This is a labeled sample record. A live source will link to the original Slack or GitHub item.</div>}
        {activity.sourceUrl && (
          <a className="external-link" href={activity.sourceUrl} target="_blank" rel="noreferrer">
            Open original source <ExternalLink size={14} />
          </a>
        )}
      </section>
    </div>
  )
}

function InsightCard({
  insight,
  activities,
  onOpenSource,
}: {
  insight: Insight
  activities: Activity[]
  onOpenSource: (activity: Activity) => void
}) {
  const byId = new Map(activities.map((activity) => [activity.id, activity]))
  const evidence = insight.evidenceIds.map((id) => byId.get(id)).filter((item): item is Activity => Boolean(item))

  return (
    <article className="insight-card">
      <div className="insight-card-header">
        <h4>{insight.title}</h4>
        {insight.category === 'possible_decision' && <span className="status-pill">Unverified</span>}
        {insight.category === 'next_action' && <span className="status-pill status-pill--blue">Suggestion</span>}
      </div>
      <p>{insight.body}</p>
      <div className="evidence-row" aria-label="Supporting sample records">
        {evidence.map((activity) => (
          <button className="evidence-chip" type="button" key={activity.id} onClick={() => onOpenSource(activity)}>
            <SourceMark source={activity.source} />
            <span>{activity.source === 'slack' ? 'Slack' : 'GitHub'} evidence</span>
            <ChevronRight size={13} />
          </button>
        ))}
      </div>
    </article>
  )
}

function Summary({ result, onOpenSource }: { result: CatchUpResult; onOpenSource: (activity: Activity) => void }) {
  return (
    <section className="summary-section" aria-live="polite">
      <div className="section-heading summary-heading">
        <div>
          <div className="eyebrow">TEAM ACTIVITY</div>
          <h2>Updates across the example team</h2>
          <p>{formatResultRange(result)} · Generated {formatDateTime(result.generatedAt)}</p>
        </div>
        <span className="mode-pill"><Sparkles size={14} /> {result.mode === 'demo' ? 'Sample analysis' : 'Live activity'}</span>
      </div>

      {result.mode === 'live' && <div className="analysis-notice"><Info size={17} /> Live source records are shown below. AI analysis is not connected yet, so possible decisions and next actions have not been inferred.</div>}
      {result.mode === 'live' && result.sources && <div className="analysis-notice">{(['slack', 'github'] as const).map((source) => { const status = result.sources?.[source]; return <span key={source}>{source === 'slack' ? 'Slack' : 'GitHub'}: {status?.state === 'ready' ? `${status.count} records` : status?.state === 'error' ? `error — ${status.message}` : 'not configured'} · </span> })}</div>}
      {result.activities.length === 0 ? (
        <div className="empty-result">
          <Check size={26} />
          <h3>{result.mode === 'live' && Object.values(result.sources || {}).some((source) => source.state === 'error') ? 'Activity could not be fully loaded' : 'No new activity in this range'}</h3>
          <p>{result.mode === 'live' && Object.values(result.sources || {}).some((source) => source.state === 'error') ? 'One or more sources failed. Check the source status above, then try again.' : result.mode === 'demo' ? 'The sample sources have no records after this catch-up point. Try another range to review earlier activity.' : 'The connected sources have no records in this range. Try another range to review earlier activity.'}</p>
        </div>
      ) : (
        <>
          {result.mode === 'demo' ? <><div className="summary-overview">
            <div><strong>{result.activities.length}</strong><span>activity records</span></div>
            <div><strong>{result.insights.filter((item) => item.category === 'possible_decision').length}</strong><span>possible decisions</span></div>
            <div><strong>{result.insights.filter((item) => item.category === 'unresolved').length}</strong><span>open questions</span></div>
            <div><strong>{result.insights.filter((item) => item.category === 'next_action').length}</strong><span>suggested actions</span></div>
          </div>
          <div className="analysis-notice"><Info size={17} /> These highlights are scripted from sample records. They are not live AI conclusions or confirmed project decisions.</div>
          <div className="insight-grid">
            {insightSections.map(({ id, title, note, icon: Icon }) => {
              const items = result.insights.filter((insight) => insight.category === id)
              return (
                <section className={`insight-section insight-section--${id}`} key={id} aria-labelledby={`heading-${id}`}>
                  <div className="insight-section-heading">
                    <span className="insight-icon"><Icon size={18} /></span>
                    <div><h3 id={`heading-${id}`}>{title}</h3><p>{note}</p></div>
                    <span className="section-count">{items.length}</span>
                  </div>
                  <div className="insight-list">
                    {items.length > 0 ? items.map((item) => (
                      <InsightCard key={item.id} insight={item} activities={result.activities} onOpenSource={onOpenSource} />
                    )) : <p className="no-insights">No items identified in this range.</p>}
                  </div>
                </section>
              )
            })}
          </div></> : <div className="summary-overview"><div><strong>{result.activities.length}</strong><span>live activity records</span></div></div>}
        </>
      )}
    </section>
  )
}

function ActivityFeed({
  activities,
  mode,
  onOpenSource,
}: {
  activities: Activity[]
  mode: CatchUpResult['mode']
  onOpenSource: (activity: Activity) => void
}) {
  const [filter, setFilter] = useState<'all' | ActivitySource>('all')
  const visible = useMemo(
    () => activities.filter((activity) => filter === 'all' || activity.source === filter),
    [activities, filter],
  )

  return (
    <section className="activity-section" aria-labelledby="activity-heading">
      <div className="section-heading activity-heading-row">
        <div>
          <div className="eyebrow">SOURCE RECORDS</div>
          <h2 id="activity-heading">Complete activity list</h2>
          <p>Every retrieved record for this time range{mode === 'demo' ? ', including items outside the highlights' : ' from configured sources'}.</p>
        </div>
        <ListFilter size={20} className="heading-icon" />
      </div>
      <div className="filter-row" role="group" aria-label="Filter activity by source">
        {(['all', 'slack', 'github'] as const).map((source) => (
          <button
            type="button"
            key={source}
            className={`filter-button ${filter === source ? 'filter-button--active' : ''}`}
            onClick={() => setFilter(source)}
            aria-pressed={filter === source}
          >
            {source === 'all' ? 'All sources' : source === 'slack' ? 'Slack' : 'GitHub'}
            <span>{source === 'all' ? activities.length : activities.filter((item) => item.source === source).length}</span>
          </button>
        ))}
      </div>
      <div className="activity-list">
        {visible.length === 0 ? (
          <div className="empty-feed">No {filter === 'all' ? '' : `${filter} `}records in this range.</div>
        ) : visible.map((activity) => {
          const { icon: KindIcon, label } = kindLabels[activity.kind]
          return (
            <article className="activity-item" key={activity.id}>
              <div className="activity-rail"><SourceMark source={activity.source} /></div>
              <div className="activity-main">
                <div className="activity-topline"><span><KindIcon size={14} /> {label}</span><time dateTime={activity.occurredAt}>{formatDateTime(activity.occurredAt)}</time></div>
                <h3>{activity.title}</h3>
                <p>{activity.body}</p>
                <div className="activity-bottomline"><span>{activity.location}</span><button type="button" onClick={() => onOpenSource(activity)}>{mode === 'demo' ? 'Inspect sample' : 'Inspect source'} <ArrowRight size={14} /></button></div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('insync-theme') === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })
  const [selectedRange, setSelectedRange] = useState<RangeChoice>('last24Hours')
  const [activeView, setActiveView] = useState<'pagination-demo' | 'my-work' | 'team-activity'>('pagination-demo')
  const [completedAt, setCompletedAt] = useState<Date | null>(null)
  const [result, setResult] = useState<CatchUpResult | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('insync-theme', theme) } catch { /* Storage may be unavailable. */ }
  }, [theme])

  const lastCompletedAt = completedAt
  const now = new Date()

  async function runCatchUp() {
    const startedAt = new Date()
    const window = getTimeWindow(selectedRange, startedAt, locale, lastCompletedAt)
    if (!window) return

    setIsLoading(true)
    setError(null)
    try {
      const nextResult = await createCatchUp(window, createDemoProvider(startedAt, locale), demoAnalyzer)
      setResult(nextResult)
      setCompletedAt(nextResult.generatedAt)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The catch-up could not be prepared. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><span /></span><span>InSync</span></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace views">
          <button type="button" className={`sidebar-nav-button ${activeView === 'pagination-demo' ? 'sidebar-active' : ''}`} aria-current={activeView === 'pagination-demo' ? 'page' : undefined} onClick={() => setActiveView('pagination-demo')}><Sparkles size={18} /><span>Pagination demo</span><ChevronRight size={16} /></button>
          <button type="button" className={`sidebar-nav-button ${activeView === 'my-work' ? 'sidebar-active' : ''}`} aria-current={activeView === 'my-work' ? 'page' : undefined} onClick={() => setActiveView('my-work')}><Ticket size={18} /><span>My work</span><ChevronRight size={16} /></button>
          <button type="button" className={`sidebar-nav-button ${activeView === 'team-activity' ? 'sidebar-active' : ''}`} aria-current={activeView === 'team-activity' ? 'page' : undefined} onClick={() => setActiveView('team-activity')}><MessageSquareText size={18} /><span>Team activity</span><ChevronRight size={16} /></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-theme">
          <span className="sidebar-theme-label">APPEARANCE</span>
          <div className="sidebar-theme-options" role="group" aria-label="Color theme">
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={15} /> Light</button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15} /> Dark</button>
          </div>
        </div>
        <p className="sidebar-footnote">Live team activity needs sign-in and ticket-board access.</p>
      </aside>

      <main className="main-content">
        <header className="topbar"><span>Workspace <ChevronRight size={14} /> {activeView === 'pagination-demo' ? 'Pagination demo' : activeView === 'my-work' ? 'My work' : 'Team activity'}</span><span className="topbar-mode"><span /> {activeView === 'pagination-demo' ? 'Staged scenario' : activeView === 'my-work' ? 'Task workspace' : 'Sample activity'}</span></header>
        <div className="content-wrap">
          {activeView === 'pagination-demo' ? <>
            <section className="hero">
              <span className="hero-kicker"><Sparkles size={15} /> BACK ON TRACK</span>
              <h1>Catch up on what<br /><em>affects ProductList.</em></h1>
              <p>Trace the pagination API change from Slack discussion to its pull request and frontend impact.</p>
            </section>
            <PaginationDemo />
          </> : activeView === 'my-work' ? <>
            <section className="hero">
              <span className="hero-kicker"><Sparkles size={15} /> YOUR WORK</span>
              <h1>See what may affect<br /><em>your work.</em></h1>
              <p>Pick an assigned task to see related code changes and team updates.</p>
            </section>
            <TaskAnalysisDemo />
          </> : <>
            <section className="hero">
              <span className="hero-kicker"><MessageSquareText size={15} /> TEAM ACTIVITY</span>
              <h1>See what your<br /><em>team is working on.</em></h1>
              <p>Browse the example team's Slack and GitHub activity, including updates outside your assigned tasks.</p>
            </section>
            <div className="team-scope-note" role="note"><Info size={17} /><span>This is sample activity. Live activity will require sign-in and access to the same ticket board as your assigned tasks.</span></div>
          <div className="activity-browser">
            <section className="catchup-controls" aria-labelledby="range-heading">
              <div className="controls-heading"><div><h2 id="range-heading">Choose a time range</h2><p>Sample updates appear after you click Load activity.</p></div><Clock3 size={21} /></div>
              <div className="range-grid" role="radiogroup" aria-label="Catch-up time range">
                {rangeOptions.map(({ id, title, description, icon: Icon }) => {
                  const disabled = id === 'sinceLastCatchUp' && lastCompletedAt === null
                  return (
                    <label key={id} className={`range-option ${selectedRange === id ? 'range-option--selected' : ''} ${disabled ? 'range-option--disabled' : ''}`}>
                      <input
                        type="radio"
                        name="range"
                        value={id}
                        checked={selectedRange === id}
                        onChange={() => setSelectedRange(id)}
                        disabled={disabled}
                      />
                      <span className="range-icon"><Icon size={20} /></span>
                      <strong>{title}</strong>
                      <span className="range-description">{description}</span>
                      <span className="range-dates">{getRangeDescription(id, now, lastCompletedAt)}</span>
                    </label>
                  )
                })}
              </div>
              <div className="controls-footer">
                <div><Info size={16} /><span>Using labeled Slack and GitHub sample records</span></div>
                <button className="primary-button" type="button" onClick={runCatchUp} disabled={isLoading}>
                  {isLoading ? <RefreshCw className="spin" size={17} /> : <Sparkles size={17} />}
                  {isLoading ? 'Loading activity…' : 'Load activity'}
                  {!isLoading && <ArrowRight size={17} />}
                </button>
              </div>
              {lastCompletedAt && <p className="session-note"><Check size={14} /> Last loaded: {formatDateTime(lastCompletedAt)}. This timestamp is held only for the current app session.</p>}
              {error && <p className="error-message" role="alert"><CircleAlert size={16} /> {error}</p>}
            </section>

            {result ? (
              <>
                <Summary result={result} onOpenSource={setSelectedActivity} />
                <ActivityFeed activities={result.activities} mode={result.mode} onOpenSource={setSelectedActivity} />
              </>
            ) : (
              <section className="welcome-panel">
                <span className="welcome-icon"><SearchCheck size={25} /></span>
                <div><h2>Team updates will appear here</h2><p>Choose a time range and load the sample activity.</p></div>
                <ArrowRight size={23} />
              </section>
            )}
          </div>
          </>}
          <footer className="page-footer">InSync · Sources and generation modes are labeled in each view.</footer>
        </div>
      </main>
      {selectedActivity && <SourceDetail activity={selectedActivity} mode="demo" onClose={() => setSelectedActivity(null)} />}
    </div>
  )
}
