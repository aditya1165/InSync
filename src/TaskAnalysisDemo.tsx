import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  GitPullRequest,
  Info,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import {
  fetchDemoImpact,
  fetchDemoDecisions,
  type DemoImpactResponse,
  type DemoDecisionsResponse,
  type DecisionItem,
  type EvidenceRecord,
} from './lib/task-demo.ts'

export interface TaskOption {
  id: string
  alias: string
  label: string
  endpoint: string
  component: string
  isCustom?: boolean
}

const defaultTaskOptions: TaskOption[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    alias: 'FE-12',
    label: 'FE-12: Build profile settings component (Assigned to you)',
    endpoint: 'GET /users/id',
    component: 'ProfileSettings',
  },
  {
    id: 'FE-99',
    alias: 'FE-99',
    label: 'FE-99: Explore catalog search caching (No open breaking PRs)',
    endpoint: 'GET /search/products',
    component: 'SearchCatalog',
  },
  {
    id: '__missing__',
    alias: 'None',
    label: 'None (Clear task selection)',
    endpoint: '',
    component: '',
  },
]

export function TaskAnalysisDemo() {
  const [tasks, setTasks] = useState<TaskOption[]>(defaultTaskOptions)
  const [selectedTaskId, setSelectedTaskId] = useState<string>(defaultTaskOptions[0]!.id)
  const [impactData, setImpactData] = useState<DemoImpactResponse | null>(null)
  const [decisionsData, setDecisionsData] = useState<DemoDecisionsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null)
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({})
  const [reviewStates, setReviewStates] = useState<Record<string, string>>({
    'dec-link-1': 'Needs review',
    'dec-link-2': 'Needs review',
  })

  // Add Custom Task Modal State
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customComponent, setCustomComponent] = useState('')
  const [customEndpoint, setCustomEndpoint] = useState('GET /users/id')
  const [showPromptInspection, setShowPromptInspection] = useState(false)

  // Escape key listener for accessible modal closing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEvidence(null)
        setIsAddingTask(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Load demo data
  async function loadData(taskIdToLoad: string) {
    setIsLoading(true)
    try {
      const activeTask = tasks.find((t) => t.id === taskIdToLoad)
      const param = taskIdToLoad === '__missing__' ? undefined : taskIdToLoad
      const options = activeTask
        ? {
            endpoint: activeTask.endpoint,
            taskTitle: activeTask.label,
            component: activeTask.component,
          }
        : undefined

      const [impact, decisions] = await Promise.all([
        fetchDemoImpact(param, options),
        fetchDemoDecisions(),
      ])
      setImpactData(impact)
      setDecisionsData(decisions)
    } catch {
      // Handled via state
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedTaskId)
  }, [selectedTaskId, tasks])

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customTitle.trim() || !customEndpoint.trim()) return

    const newId = `custom-task-${Date.now()}`
    const component = customComponent.trim() || 'CustomComponent'
    const newTask: TaskOption = {
      id: newId,
      alias: `FE-CUSTOM`,
      label: `${customTitle.trim()} (${component} · Custom)`,
      endpoint: customEndpoint.trim(),
      component,
      isCustom: true,
    }

    setTasks((prev) => [newTask, ...prev])
    setSelectedTaskId(newId)
    setIsAddingTask(false)
    setCustomTitle('')
    setCustomComponent('')
  }

  const handleResetToDefault = () => {
    setTasks(defaultTaskOptions)
    setSelectedTaskId(defaultTaskOptions[0]!.id)
    setReviewStates({
      'dec-link-1': 'Needs review',
      'dec-link-2': 'Needs review',
    })
    setCheckedActions({})
  }

  const toggleAction = (action: string) => {
    setCheckedActions((prev) => ({ ...prev, [action]: !prev[action] }))
  }

  const setDecisionReview = (decisionId: string, status: string) => {
    setReviewStates((prev) => ({ ...prev, [decisionId]: status }))
  }

  const handleCardTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    e.currentTarget.style.transform = `perspective(1000px) rotateY(${x / 35}deg) rotateX(${-y / 35}deg) translateY(-2px)`
  }

  const handleCardReset = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0)'
  }

  const currentTask = tasks.find((t) => t.id === selectedTaskId)

  return (
    <section className="insync-demo-container" aria-labelledby="asn04-demo-title">
      {/* 1. Header with Default User Context (Sameer) */}
      <div className="demo-header-card">
        <div className="demo-header-left">
          <div className="demo-user-badge">
            <span className="user-avatar-glow">
              <User size={15} />
            </span>
            <div>
              <div className="demo-user-name">
                Sameer <span className="user-role-tag">Research Scientist</span>
              </div>
              <div className="demo-user-sub">
                Context-Aware Developer Intelligence Platform
              </div>
            </div>
          </div>
        </div>

        <div className="demo-header-right">
          <span className="status-indicator-pill">
            <span className="indicator-dot glow-cyan" />
            AI Impact Analysis · Zero-Shot Diff Grounded
          </span>
          <button
            type="button"
            className="cyan-btn-secondary"
            onClick={() => loadData(selectedTaskId)}
            disabled={isLoading}
            aria-label="Refresh demo state"
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'Re-analyzing…' : 'Run Catch-up'}
          </button>
        </div>
      </div>

      {/* 2. Interactive Task Selector (Testing Normal vs Edge Cases) */}
      <div className="demo-selector-card">
        <div className="selector-label-group">
          <span className="selector-eyebrow">ASSIGNED TASK CONTEXT</span>
          <label htmlFor="task-select-input" className="selector-title">
            Select Assigned Task
          </label>
        </div>

        <div className="selector-controls">
          <div className="select-wrapper">
            <select
              id="task-select-input"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="cyan-select"
            >
              {tasks.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="select-arrow" />
          </div>

          <div className="task-dependency-chip">
            <Code2 size={14} className="text-cyan" />
            <span>Dependency: <strong>{currentTask?.endpoint || 'None'}</strong></span>
          </div>

          <div className="selector-btn-actions">
            <button
              type="button"
              className="cyan-btn-secondary"
              onClick={() => setIsAddingTask(true)}
              title="Add a custom task to test dynamic dependency mapping"
            >
              <Plus size={14} />
              Add Task
            </button>
            <button
              type="button"
              className="btn-ghost-cyan"
              onClick={handleResetToDefault}
              title="Reset station to Sameer's default profile task"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* 2.5 Add Custom Task Modal (Peer Reviewer Input) */}
      {isAddingTask && (
        <div className="evidence-dialog-backdrop" onClick={() => setIsAddingTask(false)}>
          <div
            className="evidence-dialog-card add-task-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-header">
              <div className="dialog-title-group">
                <span className="dialog-source-tag">Feature F2 · Interactive Input</span>
                <h4>Map a New Frontend Task</h4>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setIsAddingTask(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="custom-task-form">
              <div className="form-group">
                <label htmlFor="custom-task-title">Task Title</label>
                <input
                  id="custom-task-title"
                  type="text"
                  className="cyan-input"
                  placeholder="e.g. Build User Avatar Card"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="custom-task-comp">Component Name</label>
                <input
                  id="custom-task-comp"
                  type="text"
                  className="cyan-input"
                  placeholder="e.g. UserAvatar"
                  value={customComponent}
                  onChange={(e) => setCustomComponent(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="custom-task-endpoint">Backend API Dependency</label>
                <div className="quick-endpoint-chips">
                  {['GET /users/id', 'GET /billing/invoices', 'GET /search/products'].map((ep) => (
                    <button
                      key={ep}
                      type="button"
                      className={`endpoint-preset-btn ${customEndpoint === ep ? 'preset-active' : ''}`}
                      onClick={() => setCustomEndpoint(ep)}
                    >
                      {ep}
                    </button>
                  ))}
                </div>
                <input
                  id="custom-task-endpoint"
                  type="text"
                  className="cyan-input mt-2"
                  placeholder="e.g. GET /users/id"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  required
                />
                <span className="form-hint">
                  Tip: Mapping to <code>GET /users/id</code> dynamically triggers PR #18 breaking impact analysis! Any other endpoint tests graceful uncertainty.
                </span>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-ghost-cyan"
                  onClick={() => setIsAddingTask(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cyan-btn-primary">
                  Analyze This Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 3. Missing Task ID State */}
      {impactData?.error && (
        <div className="error-banner-card" role="alert">
          <AlertTriangle size={20} className="text-red" />
          <div>
            <strong>No Task Selected</strong>
            <p>{impactData.error}</p>
          </div>
        </div>
      )}

      {/* 4. Unknown Task ID Fallback (Impact Uncertain State) */}
      {impactData && !impactData.error && impactData.impactUncertain && (
        <div className="uncertain-banner-card" role="status">
          <ShieldAlert size={22} className="text-amber" />
          <div>
            <div className="banner-title">
              <strong>No Breaking Changes Detected</strong>
              <span className="badge-uncertain">Unaffected</span>
            </div>
            <p>{impactData.explanation}</p>
            <p className="banner-footnote">
              InSync verifies that your task's API dependency is unaffected by current open pull requests, avoiding false alerts.
            </p>
          </div>
        </div>
      )}

      {/* 5. Interaction 1: Feature F3 Task-Aware AI Impact Explanation */}
      {impactData && !impactData.error && !impactData.impactUncertain && impactData.pr && (
        <div className="demo-section-block">
          <div className="section-title-row">
            <div className="title-with-badge">
              <Sparkles size={17} className="text-cyan" />
              <h3>Code Change Impact on Assigned Task</h3>
            </div>
            <span className="confidence-badge badge-high">
              <ShieldCheck size={13} /> Verified Breaking Change · Grounded in PR #18 Diff
            </span>
          </div>

          <div className="impact-grid">
            {/* Left: PR and Diff Viewer */}
            <div
              className="pr-diff-card card-3d"
              onMouseMove={handleCardTilt}
              onMouseLeave={handleCardReset}
            >
              <div className="card-topline">
                <span className="pr-number-pill">
                  <GitPullRequest size={13} /> PR #{impactData.pr.number}
                </span>
                <span className="pr-status-pill pr-status-open">Open</span>
                <span className="pr-endpoint-pill">{impactData.pr.endpoint}</span>
              </div>

              <h4 className="pr-title">{impactData.pr.title}</h4>
              <p className="pr-desc">{impactData.pr.description}</p>

              {/* Code Diff Box */}
              <div className="diff-viewer">
                <div className="diff-viewer-header">
                  <span>PATCH DIFF · api/users.json</span>
                  <span>Unified Diff</span>
                </div>
                <pre className="diff-code">
                  <code>
                    <span className="diff-line diff-context">{'@@ -1,4 +1,4 @@'}</span>
                    <span className="diff-line diff-context">{' {'}</span>
                    <span className="diff-line diff-context">{'   "id": "123",'}</span>
                    <span className="diff-line diff-del">{'-  "user_name": "string",'}</span>
                    <span className="diff-line diff-add">{'+  "display_name": "string"'}</span>
                    <span className="diff-line diff-context">{' }'}</span>
                  </code>
                </pre>
              </div>

              {/* Evidence Attribution */}
              <div className="evidence-chips-row">
                <span className="evidence-label">Inspectable Evidence:</span>
                {impactData.evidence?.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="evidence-chip-btn"
                    onClick={() => setSelectedEvidence(ev)}
                  >
                    <span>{ev.title}</span>
                    <ChevronRight size={12} />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: AI Explanation & Actionable Checklist */}
            <div className="explanation-actions-card">
              <div className="ai-explanation-box">
                <div className="ai-box-header">
                  <Sparkles size={15} className="text-cyan" />
                  <strong>Zero-Shot AI Impact Explanation</strong>
                  <span className="model-tag">{impactData.zeroShot?.model || 'gpt-4o-zero-shot'}</span>
                </div>
                <p className="ai-explanation-text">{impactData.explanation}</p>
                <button
                  type="button"
                  className="btn-prompt-inspect"
                  onClick={() => setShowPromptInspection(!showPromptInspection)}
                >
                  {showPromptInspection ? 'Hide Zero-Shot Prompt & AST Trace ▲' : 'Inspect Zero-Shot Prompt & AST Trace ▼'}
                </button>
                {showPromptInspection && (
                  <div className="prompt-inspection-drawer">
                    <div className="prompt-drawer-title">System Role:</div>
                    <pre className="prompt-pre">{impactData.zeroShot?.systemPrompt || 'Expert software architect analyzing PR diffs against task dependencies.'}</pre>
                    <div className="prompt-drawer-title mt-2">Zero-Shot User Prompt:</div>
                    <pre className="prompt-pre">{impactData.zeroShot?.promptTemplate || 'Diff analysis against task component.'}</pre>
                    <div className="prompt-drawer-title mt-2">AST Reasoning Trace:</div>
                    <p className="prompt-trace-p">{impactData.zeroShot?.reasoningTrace || 'Unified diff AST parser detected field user_name replaced with display_name on GET /users/id.'}</p>
                  </div>
                )}
              </div>

              <div className="recommended-actions-box">
                <div className="actions-header">
                  <CheckCircle2 size={15} className="text-cyan" />
                  <strong>Recommended Next Actions</strong>
                </div>
                <ul className="actions-checklist">
                  {impactData.recommendedActions.map((action) => (
                    <li
                      key={action}
                      className={`action-item ${checkedActions[action] ? 'action-done' : ''}`}
                      onClick={() => toggleAction(action)}
                    >
                      <span className="action-checkbox">
                        {checkedActions[action] && <Check size={12} />}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Feature F4: Decision-to-PR Linking */}
      {decisionsData && (
        <div className="demo-section-block">
          <div className="section-title-row">
            <div className="title-with-badge">
              <MessageSquare size={17} className="text-cyan" />
              <h3>Related Team Discussions & Decision Alignment</h3>
            </div>
            <span className="provenance-tag">Cross-Source Decision Alignment</span>
          </div>

          <div className="decisions-grid">
            {decisionsData.decisions.map((decision: DecisionItem) => {
              const isTrap = decision.isTrap
              const review = reviewStates[decision.id] || 'Needs review'

              return (
                <div
                  key={decision.id}
                  className={`decision-card card-3d ${isTrap ? 'trap-card' : 'truth-card'}`}
                  onMouseMove={handleCardTilt}
                  onMouseLeave={handleCardReset}
                >
                  <div className="decision-card-topline">
                    <span className="decision-channel-badge">
                      <MessageSquare size={13} /> {decision.channel}
                    </span>
                    <span
                      className={`decision-status-badge ${
                        isTrap ? 'status-trap' : 'status-truth'
                      }`}
                    >
                      {isTrap ? (
                        <>
                          <AlertTriangle size={12} /> {decision.statusLabel}
                        </>
                      ) : (
                        <>
                          <Check size={12} /> {decision.statusLabel}
                        </>
                      )}
                    </span>
                  </div>

                  {isTrap && (
                    <div className="trap-warning-banner">
                      <ShieldAlert size={15} className="text-amber flex-shrink-0" />
                      <span>
                        <strong>Unverified Proposal:</strong> This thread discusses an unconfirmed proposal regarding <code>email_verified</code>. It is NOT an approved team decision or merged pull request.
                      </span>
                    </div>
                  )}

                  <div className="decision-message-bubble">
                    <div className="bubble-author">
                      <span>{decision.author}</span>
                      <span className="bubble-time">Slack Discussion</span>
                    </div>
                    <p className="bubble-text">"{decision.slackMessage}"</p>
                  </div>

                  <div className="match-rationale-box">
                    <strong>Link Rationale:</strong> {decision.matchRationale}
                  </div>

                  <div className={`grounding-status-box ${isTrap ? 'box-trap' : 'box-truth'}`}>
                    <div className="grounding-header">
                      {isTrap ? (
                        <>
                          <ShieldAlert size={14} className="text-amber flex-shrink-0" />
                          <strong>Verification Status: Unverified Proposal</strong>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} className="text-emerald flex-shrink-0" />
                          <strong>Verification Status: Confirmed Team Decision</strong>
                        </>
                      )}
                    </div>
                    <p className="grounding-detail">
                      {isTrap
                        ? 'Proposal has not been approved by the team and has 0 matching lines in PR #18 diff.'
                        : 'Confirmed decision explicitly matches line-level deletion of user_name in PR #18.'}
                    </p>
                  </div>

                  {/* F5 User Controls */}
                  <div className="f5-review-container">
                    <div className="f5-label-row">
                      <span>Your Decision:</span>
                      <span className={`review-status-label review-status-${review.toLowerCase().replace(/\s+/g, '-')}`}>
                        {review}
                      </span>
                    </div>

                    <div className="f5-btn-group" role="group" aria-label="Review controls">
                      {['Confirm', 'Not Relevant', 'Remind Later'].map((action) => {
                        const isActive = review === action
                        const activeClass = !isActive
                          ? ''
                          : action === 'Confirm'
                          ? 'f5-active-confirm'
                          : action === 'Not Relevant'
                          ? 'f5-active-not-relevant'
                          : 'f5-active-remind-later'

                        return (
                          <button
                            key={action}
                            type="button"
                            className={`f5-action-btn ${activeClass}`}
                            onClick={() => setDecisionReview(decision.id, action)}
                          >
                            {action}
                          </button>
                        )
                      })}
                      {review !== 'Needs review' && (
                        <button
                          type="button"
                          className="f5-undo-btn"
                          onClick={() => setDecisionReview(decision.id, 'Needs review')}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}


      {/* 7. Modal / Slide-out for Inspecting Source Evidence */}
      {selectedEvidence && (
        <div className="evidence-dialog-backdrop" onClick={() => setSelectedEvidence(null)}>
          <div
            className="evidence-dialog-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-header">
              <div className="dialog-title-group">
                <span className="dialog-source-tag">{selectedEvidence.source || 'source'}</span>
                <h4>{selectedEvidence.title}</h4>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setSelectedEvidence(null)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div className="dialog-location">{selectedEvidence.location}</div>
            <div className="dialog-body-pre">
              <pre>{selectedEvidence.body}</pre>
            </div>
            <div className="dialog-footer">
              <span className="dialog-footnote">
                <Info size={14} /> Provenance Verified · Zero persistent external storage
              </span>
              <button
                type="button"
                className="cyan-btn-secondary"
                onClick={() => setSelectedEvidence(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
