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
  RefreshCw,
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

export function TaskAnalysisDemo() {
  // Demo task options for evaluators to test edge cases
  const taskOptions = [
    {
      id: 'd0000000-0000-4000-8000-000000000001',
      alias: 'FE-12',
      label: 'Build profile settings component (Sameer · Assigned)',
      endpoint: 'GET /users/id',
      component: 'ProfileSettings',
    },
    {
      id: 'FE-99',
      alias: 'FE-99',
      label: 'Explore catalog search caching (Unmapped Task · Edge Case)',
      endpoint: 'GET /search/products',
      component: 'SearchCatalog',
    },
    {
      id: '__missing__',
      alias: 'None',
      label: '[Simulate Missing Task ID · Error 400]',
      endpoint: '',
      component: '',
    },
  ]

  const [selectedTaskId, setSelectedTaskId] = useState<string>(taskOptions[0]!.id)
  const [impactData, setImpactData] = useState<DemoImpactResponse | null>(null)
  const [decisionsData, setDecisionsData] = useState<DemoDecisionsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null)
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({})
  const [reviewStates, setReviewStates] = useState<Record<string, string>>({
    'dec-link-1': 'Needs review',
    'dec-link-2': 'Needs review',
  })

  // Load demo data
  async function loadData(taskIdToLoad: string) {
    setIsLoading(true)
    try {
      const param = taskIdToLoad === '__missing__' ? undefined : taskIdToLoad
      const [impact, decisions] = await Promise.all([
        fetchDemoImpact(param),
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
  }, [selectedTaskId])

  const toggleAction = (action: string) => {
    setCheckedActions((prev) => ({ ...prev, [action]: !prev[action] }))
  }

  const setDecisionReview = (decisionId: string, status: string) => {
    setReviewStates((prev) => ({ ...prev, [decisionId]: status }))
  }

  const currentTask = taskOptions.find((t) => t.id === selectedTaskId)

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
              <div className="demo-user-name">Sameer <span className="user-role-tag">Frontend Dev</span></div>
              <div className="demo-user-sub">Default Authenticated User · Workspace: InSync Demo</div>
            </div>
          </div>
        </div>

        <div className="demo-header-right">
          <span className="status-indicator-pill">
            <span className="indicator-dot glow-cyan" />
            Deterministic Demo Fixtures (Zero Hallucination)
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
          <span className="selector-eyebrow">FEATURE F1 / F2 · TASK CONTEXT SELECTOR</span>
          <label htmlFor="task-select-input" className="selector-title">
            Select an Assigned Frontend Task to Analyze
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
              {taskOptions.map((opt) => (
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
        </div>
      </div>

      {/* 3. Missing Task ID Error State (400 Bad Request Edge Case) */}
      {impactData?.error && (
        <div className="error-banner-card" role="alert">
          <AlertTriangle size={20} className="text-red" />
          <div>
            <strong>HTTP 400 Bad Request · Edge Case Handled</strong>
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
              <strong>Impact Uncertain · Unmapped Task Context</strong>
              <span className="badge-uncertain">Fallback Active</span>
            </div>
            <p>{impactData.explanation}</p>
            <p className="banner-footnote">
              ASN-03 / ASN-04 Rule: When an unmapped task context is selected, InSync does not hallucinate breaking changes; it surfaces uncertainty and prompts manual inspection.
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
              <h3>Interaction 1: Task-Aware Code-Change Impact (F3)</h3>
            </div>
            <span className="confidence-badge badge-high">
              <ShieldCheck size={13} /> High Confidence · 98%
            </span>
          </div>

          <div className="impact-grid">
            {/* Left: PR and Diff Viewer */}
            <div className="pr-diff-card">
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
                  <strong>AI Impact Explanation</strong>
                  <span className="model-tag">scripted_demo</span>
                </div>
                <p className="ai-explanation-text">{impactData.explanation}</p>
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

      {/* 6. Interaction 2: Feature F4 Decision-to-PR Linking & Planted Trap */}
      {decisionsData && (
        <div className="demo-section-block">
          <div className="section-title-row">
            <div className="title-with-badge">
              <MessageSquare size={17} className="text-cyan" />
              <h3>Interaction 2: Decision-to-PR Linking & Planted Trap (F4 / F5)</h3>
            </div>
            <span className="provenance-tag">USC HCI Evaluation Testbed</span>
          </div>

          <div className="decisions-grid">
            {decisionsData.decisions.map((decision: DecisionItem) => {
              const isTrap = decision.isTrap
              const review = reviewStates[decision.id] || 'Needs review'

              return (
                <div
                  key={decision.id}
                  className={`decision-card ${isTrap ? 'trap-card' : 'truth-card'}`}
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
                      <ShieldAlert size={15} className="text-red flex-shrink-0" />
                      <span>
                        <strong>Planted Evaluation Trap:</strong> This is an unverified proposal regarding <code>email_verified</code>. It is NOT an approved fact or merged PR change.
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

                  <div className="confidence-meter-row">
                    <span className="confidence-meter-label">Match Confidence:</span>
                    <div className="confidence-bar-bg">
                      <div
                        className={`confidence-bar-fill ${
                          isTrap ? 'bar-low' : 'bar-high'
                        }`}
                        style={{ width: `${Math.round(decision.confidenceScore * 100)}%` }}
                      />
                    </div>
                    <span className="confidence-meter-value">
                      {Math.round(decision.confidenceScore * 100)}% ({decision.confidence})
                    </span>
                  </div>

                  {/* F5 User Controls */}
                  <div className="f5-review-container">
                    <div className="f5-label-row">
                      <span>Human Verification (F5):</span>
                      <span className={`review-status-label review-status-${review.toLowerCase().replace(/\s+/g, '-')}`}>
                        {review}
                      </span>
                    </div>

                    <div className="f5-btn-group" role="group" aria-label="Review controls">
                      {['Confirm', 'Not Relevant', 'Remind Later'].map((action) => (
                        <button
                          key={action}
                          type="button"
                          className={`f5-action-btn ${review === action ? 'f5-btn-active' : ''}`}
                          onClick={() => setDecisionReview(decision.id, action)}
                        >
                          {action}
                        </button>
                      ))}
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
