import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronRight, FileCode2, GitPullRequest, Info, MessageSquare, RefreshCw, Ticket } from 'lucide-react'
import { diffLineKind, exampleChangesForImpact, type ChangeFile } from './lib/change-demo.ts'
import { fetchDemoDecisions, fetchDemoImpact, type DemoDecisionsResponse, type DemoImpactResponse, type EvidenceRecord } from './lib/task-demo.ts'
import { fetchAssignedTasks, type AssignedTask } from './lib/tasks.ts'

interface JiraTask {
  id: string
  key: string
  title: string
  description: string
  endpoint: string
  component: string
}

const exampleJiraTasks: JiraTask[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    key: 'FE-12',
    title: 'Profile settings',
    description: 'Build the page where people update their profile.',
    endpoint: 'GET /users/id',
    component: 'ProfileSettings',
  },
  {
    id: 'FE-99',
    key: 'FE-99',
    title: 'Catalog search',
    description: 'Explore ways to make product search faster.',
    endpoint: 'GET /search/products',
    component: 'SearchCatalog',
  },
]

function ChangeDiff({ file }: { file: ChangeFile }) {
  return (
    <div className="change-diff">
      <div className="change-diff-header"><FileCode2 size={16} /><strong>{file.path}</strong><span>File changes</span></div>
      <pre aria-label={`Changes in ${file.path}`}><code>
        {file.patch.split('\n').map((line, index) => (
          <span className={`change-diff-line change-diff-line--${diffLineKind(line)}`} key={index}>{line || ' '}</span>
        ))}
      </code></pre>
    </div>
  )
}

function EvidenceDialog({ record, onClose }: { record: EvidenceRecord; onClose: () => void }) {
  const isTask = record.source === 'task_mapping'
  return (
    <div className="evidence-dialog-backdrop" onMouseDown={onClose}>
      <div className="evidence-dialog-card" role="dialog" aria-modal="true" aria-labelledby="example-source-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title-group">
            <span className="dialog-source-tag">{isTask ? 'Example Jira task detail' : `Sample ${record.source || 'source'}`}</span>
            <h4 id="example-source-title">{isTask ? 'Why this may affect your work' : record.title}</h4>
          </div>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="Close source details">×</button>
        </div>
        {!isTask && record.location && <div className="dialog-location">{record.location}</div>}
        <div className="dialog-body-pre"><pre>{isTask
          ? 'The profile settings page currently uses the old name in the profile information. That is why this proposed change appears for this task.'
          : record.body}</pre></div>
        <div className="dialog-footer">
          <span className="dialog-footnote"><Info size={14} /> Example record · For review only</span>
          <button type="button" className="cyan-btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function SampleTaskAnalysis() {
  const requestId = useRef(0)
  const [selectedTaskId, setSelectedTaskId] = useState(exampleJiraTasks[0]!.id)
  const [impactData, setImpactData] = useState<DemoImpactResponse | null>(null)
  const [decisionsData, setDecisionsData] = useState<DemoDecisionsResponse | null>(null)
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedEvidence(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedTask = exampleJiraTasks.find((task) => task.id === selectedTaskId)!
  const changes = impactData ? exampleChangesForImpact(impactData) : []
  const selectedChange = changes.find((change) => change.id === selectedChangeId) ?? changes[0]
  const selectedFile = selectedChange?.files.find((file) => file.path === selectedFilePath) ?? selectedChange?.files[0]
  const relatedDecisions = selectedChange?.id === impactData?.pr?.id ? decisionsData?.decisions ?? [] : []

  function chooseTask(taskId: string) {
    if (taskId === selectedTaskId) return
    requestId.current += 1
    setSelectedTaskId(taskId)
    setImpactData(null)
    setDecisionsData(null)
    setSelectedChangeId(null)
    setSelectedFilePath(null)
    setLoadError(null)
    setIsLoading(false)
  }

  async function runCatchUp() {
    const currentRequest = ++requestId.current
    setIsLoading(true)
    setLoadError(null)
    setImpactData(null)
    setDecisionsData(null)
    setSelectedChangeId(null)
    setSelectedFilePath(null)
    try {
      const [impact, decisions] = await Promise.all([
        fetchDemoImpact(selectedTask.id, {
          endpoint: selectedTask.endpoint,
          taskTitle: selectedTask.title,
          component: selectedTask.component,
        }),
        fetchDemoDecisions(),
      ])
      if (requestId.current !== currentRequest) return
      setImpactData(impact)
      setDecisionsData(decisions)
    } catch {
      if (requestId.current === currentRequest) setLoadError('We could not load the example updates. Please try again.')
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false)
    }
  }

  return (
    <section className="insync-demo-container" aria-label="Example Jira task catch-up">
      <div className="demo-selector-card jira-task-picker">
        <div className="selector-label-group">
          <span className="selector-eyebrow"><Ticket size={15} /> SAMPLE JIRA ASSIGNMENTS</span>
          <h2 className="selector-title">My tasks</h2>
          <p className="selector-description">Choose what you’re working on, then catch up. These assignments are examples, not a live Jira connection.</p>
        </div>
        <div className="task-card-grid" role="group" aria-label="Choose a Jira task">
          {exampleJiraTasks.map((task) => (
            <button key={task.id} type="button" className={`task-choice-card ${selectedTaskId === task.id ? 'task-choice-card--selected' : ''}`} aria-pressed={selectedTaskId === task.id} onClick={() => chooseTask(task.id)}>
              <span className="task-choice-top"><span>Jira · {task.key}</span><span>{selectedTaskId === task.id ? 'Selected' : 'Select'}</span></span>
              <strong>{task.title}</strong>
              <span className="task-choice-description">{task.description}</span>
            </button>
          ))}
        </div>
        <div className="jira-picker-footer">
          <span>Updates appear after you click.</span>
          <button type="button" className="cyan-btn-primary" disabled={isLoading} onClick={runCatchUp}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <ArrowRight size={16} />}
            {isLoading ? 'Loading updates…' : 'Catch me up'}
          </button>
        </div>
        {loadError && <p className="error-message" role="alert"><AlertTriangle size={16} /> {loadError}</p>}
      </div>

      {impactData?.error && <div className="error-banner-card" role="alert"><AlertTriangle size={18} /><span>{impactData.error}</span></div>}
      {impactData && !impactData.error && impactData.impactUncertain && (
        <div className="uncertain-banner-card" role="status">
          <Info size={20} />
          <div><strong>No linked change in this example</strong><p>We don’t have enough information to say whether {selectedTask.title.toLowerCase()} is affected.</p></div>
        </div>
      )}

      {selectedChange && (
        <div className="demo-section-block">
          <div className="section-title-row">
            <div className="title-with-badge"><GitPullRequest size={18} className="text-cyan" /><h3>Changes for {selectedTask.title}</h3></div>
            <span className="provenance-tag">{changes.length} sample proposals</span>
          </div>
          <div className="change-workspace">
            <nav className="change-list" aria-label="Proposed changes">
              {changes.map((change) => (
                <button key={change.id} type="button" className={`change-list-item ${selectedChange.id === change.id ? 'change-list-item--active' : ''}`} aria-current={selectedChange.id === change.id ? 'true' : undefined} onClick={() => { setSelectedChangeId(change.id); setSelectedFilePath(null) }}>
                  <span className="change-list-meta">PR #{change.number} · {change.status === 'draft' ? 'Draft' : 'Open'}</span>
                  <strong>{change.title}</strong>
                  <span>{change.files.length} {change.files.length === 1 ? 'file' : 'files'} changed <ChevronRight size={14} /></span>
                </button>
              ))}
            </nav>
            <article className="change-detail">
              <div className="change-detail-top"><span className="pr-number-pill"><GitPullRequest size={14} /> PR #{selectedChange.number}</span><span className="pr-status-pill pr-status-open">{selectedChange.status}</span><span className="sample-label">Example</span></div>
              <h4>{selectedChange.title}</h4>
              <p className="change-summary">{selectedChange.summary}</p>
              <div className="change-next-step"><strong>Suggested next step</strong><p>{selectedChange.nextStep}</p></div>
              <div className="change-files-heading"><strong>Files changed</strong><span>Choose a file to inspect the proposed edits.</span></div>
              <div className="change-file-tabs" role="group" aria-label="Changed files">
                {selectedChange.files.map((file) => (
                  <button key={file.path} type="button" aria-pressed={selectedFile?.path === file.path} onClick={() => setSelectedFilePath(file.path)}><FileCode2 size={14} /> {file.path}</button>
                ))}
              </div>
              {selectedFile && <ChangeDiff file={selectedFile} />}
              <div className="change-evidence" aria-label="Inspect example sources">
                {selectedChange.evidence.map((record) => (
                  <button key={record.id} type="button" onClick={() => setSelectedEvidence(record)}>{record.source === 'task_mapping' ? 'Why this may affect your work' : `View sample PR #${selectedChange.number}`} <ChevronRight size={14} /></button>
                ))}
              </div>
            </article>
          </div>
        </div>
      )}

      {relatedDecisions.length > 0 && decisionsData && (
        <div className="demo-section-block">
          <div className="section-title-row"><div className="title-with-badge"><MessageSquare size={18} className="text-cyan" /><h3>From Slack</h3></div><span className="provenance-tag">Sample updates for PR #{selectedChange?.number}</span></div>
          <div className="decisions-grid">
            {relatedDecisions.map((decision) => {
              const isQuestion = decision.decisionStatus !== 'confirmed'
              const slackSource = decisionsData.evidence.find((record) => record.id === decision.decisionId)
              const changeSource = decisionsData.evidence.find((record) => record.id === decision.prId)
              return (
                <article key={decision.id} className={`decision-card ${isQuestion ? 'trap-card' : 'truth-card'}`}>
                  <div className="decision-card-topline"><span className="decision-channel-badge"><MessageSquare size={14} /> {decision.channel}</span><span className={`decision-status-badge ${isQuestion ? 'status-trap' : 'status-truth'}`}>{isQuestion ? 'Open question' : 'Team decision'}</span></div>
                  <div className="decision-plain-summary">
                    <h4>{isQuestion ? 'Email verification was only suggested' : 'The team agreed to change profile names'}</h4>
                    <p>{isQuestion ? 'This idea is still being discussed and is not part of the selected change.' : 'The Slack decision matches this proposed change. The code change is still open.'}</p>
                  </div>
                  <div className="decision-source-links">
                    {slackSource && <button type="button" onClick={() => setSelectedEvidence(slackSource)}><MessageSquare size={14} /> View Slack source <ChevronRight size={13} /></button>}
                    {changeSource && <button type="button" onClick={() => setSelectedEvidence(changeSource)}><GitPullRequest size={14} /> View proposed change <ChevronRight size={13} /></button>}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}

      {selectedEvidence && <EvidenceDialog record={selectedEvidence} onClose={() => setSelectedEvidence(null)} />}
    </section>
  )
}

const taskStatusLabels: Record<AssignedTask['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

function DatabaseTasks() {
  const [tasks, setTasks] = useState<AssignedTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const nextTasks = await fetchAssignedTasks()
      setTasks(nextTasks)
      setSelectedId((current) => nextTasks.some((task) => task.id === current) ? current : nextTasks[0]?.id ?? null)
    } catch (cause) {
      setTasks([])
      setSelectedId(null)
      setError(cause instanceof Error ? cause.message : 'Tasks could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTasks() }, [])
  const selectedTask = tasks.find((task) => task.id === selectedId)

  return (
    <section className="demo-selector-card database-task-panel" aria-label="Supabase assignments">
      <div className="database-task-heading">
        <div><span className="selector-eyebrow"><Ticket size={15} /> SUPABASE TASKS</span><h2 className="selector-title">My tasks</h2></div>
        <button type="button" className="cyan-btn-secondary" disabled={loading} onClick={() => { void loadTasks() }}><RefreshCw size={15} /> Refresh</button>
      </div>
      {loading ? <p className="database-task-message" role="status">Loading assigned tasks…</p>
        : error ? <p className="database-task-message" role="alert">{error} The sample demo is available above.</p>
          : tasks.length === 0 ? <p className="database-task-message">No assigned tasks are in this Supabase workspace yet. No sample rows have been added.</p>
            : <>
              <div className="task-card-grid" role="group" aria-label="Supabase tasks">
                {tasks.map((task) => (
                  <button key={task.id} type="button" className={`task-choice-card ${selectedId === task.id ? 'task-choice-card--selected' : ''}`} aria-pressed={selectedId === task.id} onClick={() => setSelectedId(task.id)}>
                    <span className="task-choice-top"><span>{taskStatusLabels[task.status]}</span><span>{selectedId === task.id ? 'Selected' : 'Select'}</span></span>
                    <strong>{task.title}</strong>
                  </button>
                ))}
              </div>
              {selectedTask && <div className="database-task-detail"><strong>{selectedTask.title}</strong><p>{selectedTask.dependencies.length > 0 ? `${selectedTask.dependencies.length} mapped API ${selectedTask.dependencies.length === 1 ? 'endpoint' : 'endpoints'}` : 'No API mapping recorded yet.'}</p><details><summary>Technical details</summary><p>Component: {selectedTask.component}</p>{selectedTask.dependencies.map((dependency) => <p key={dependency.endpoint}>{dependency.endpoint}{dependency.usedFields.length > 0 ? ` · Uses ${dependency.usedFields.join(', ')}` : ''}</p>)}</details></div>}
              <p className="database-task-message">These assignments come from Supabase. Live PR and Slack analysis for them is not connected yet.</p>
            </>}
    </section>
  )
}

export function TaskAnalysisDemo() {
  const [source, setSource] = useState<'database' | 'sample'>('database')
  return <>
    <div className="task-source-switch" role="group" aria-label="Task data source">
      <button type="button" aria-pressed={source === 'database'} onClick={() => setSource('database')}>Supabase tasks</button>
      <button type="button" aria-pressed={source === 'sample'} onClick={() => setSource('sample')}>Sample demo</button>
    </div>
    {source === 'database' ? <DatabaseTasks /> : <SampleTaskAnalysis />}
  </>
}
