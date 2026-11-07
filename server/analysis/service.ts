import type { Activity } from '../../src/lib/catchup.ts'

export interface TaskContext {
  id: string
  component: string
  dependency: { evidenceId: string; endpoint: string; usedFields: readonly string[] }
}

export interface PullRequestEvidence {
  activity: Activity & { kind: 'github_pull_request'; source: 'github' }
  lifecycle: 'draft' | 'open' | 'closed' | 'merged'
  endpoints: readonly string[]
  diff?: { text: string; complete: boolean }
}

export interface DecisionEvidence {
  messages: readonly (Activity & { source: 'slack' })[]
  // A confirmed status must come from verified source evidence supplied by the caller.
  status: 'proposed' | 'unresolved' | 'confirmed' | 'unknown'
}

interface ImpactInput {
  task: TaskContext
  pr: PullRequestEvidence
}

interface LinkInput extends ImpactInput {
  decision: DecisionEvidence
}

export interface AnalysisEngine {
  generatedBy: 'scripted_demo' | 'llm'
  impact(input: ImpactInput): Promise<unknown>
  link(input: LinkInput): Promise<unknown>
}

interface Suggestion {
  summary: string
  evidenceIds: string[]
}

type AnalysisResult<T extends Suggestion> =
  | { status: 'suggested'; generatedBy: AnalysisEngine['generatedBy']; suggestion: T }
  | { status: 'uncertain'; reason: 'insufficient_evidence' | 'invalid_output' | 'engine_unavailable'; evidenceIds: string[] }
  | { status: 'no_match' }

function readSuggestion(value: unknown, required: readonly string[], allowed: readonly string[]): Suggestion | null {
  if (!value || typeof value !== 'object' || !('summary' in value) || !('evidenceIds' in value)) return null
  const { summary, evidenceIds } = value
  if (typeof summary !== 'string' || !summary.trim() || !Array.isArray(evidenceIds)) return null
  if (!evidenceIds.every((id): id is string => typeof id === 'string' && allowed.includes(id))) return null
  if (!required.every((id) => evidenceIds.includes(id))) return null
  return { summary: summary.trim(), evidenceIds: [...new Set(evidenceIds)] }
}

async function runAnalysis<T extends Suggestion>(
  engine: AnalysisEngine,
  evaluate: () => Promise<unknown>,
  evidenceIds: string[],
  parse: (value: unknown) => T | null,
): Promise<AnalysisResult<T>> {
  try {
    const value = await evaluate()
    if (value === null) return { status: 'no_match' }
    const suggestion = parse(value)
    if (suggestion) return { status: 'suggested', generatedBy: engine.generatedBy, suggestion }
    return { status: 'uncertain', reason: 'invalid_output', evidenceIds }
  } catch {
    return { status: 'uncertain', reason: 'engine_unavailable', evidenceIds }
  }
}

export async function explainImpact(input: ImpactInput, engine: AnalysisEngine) {
  const { task, pr } = input
  const evidenceIds = [task.dependency.evidenceId, pr.activity.id]
  const context = { taskId: task.id, prId: pr.activity.id, lifecycle: pr.lifecycle }
  if (!pr.diff?.complete || !pr.diff.text.trim() || !pr.endpoints.includes(task.dependency.endpoint)) {
    return { ...context, result: { status: 'uncertain', reason: 'insufficient_evidence', evidenceIds } as const }
  }

  const result = await runAnalysis(engine, () => engine.impact(input), evidenceIds, (value) => {
    const suggestion = readSuggestion(value, evidenceIds, evidenceIds)
    if (!suggestion || !value || typeof value !== 'object' || !('nextAction' in value)) return null
    if (typeof value.nextAction !== 'string' || !value.nextAction.trim()) return null
    return { ...suggestion, nextAction: value.nextAction.trim() }
  })
  return { ...context, result }
}

export async function suggestDecisionLink(input: LinkInput, engine: AnalysisEngine) {
  const { task, pr, decision } = input
  const slackIds = decision.messages.filter((message) => message.body.trim()).map((message) => message.id)
  const evidenceIds = [pr.activity.id, ...slackIds]
  const context = {
    taskId: task.id,
    prId: pr.activity.id,
    decisionStatus: slackIds.length ? decision.status : 'unknown' as const,
  }
  if (!slackIds.length || !pr.endpoints.includes(task.dependency.endpoint)) {
    return { ...context, result: { status: 'uncertain', reason: 'insufficient_evidence', evidenceIds } as const }
  }

  const result = await runAnalysis(engine, () => engine.link(input), evidenceIds, (value) => {
    const suggestion = readSuggestion(value, [pr.activity.id], evidenceIds)
    return suggestion?.evidenceIds.some((id) => slackIds.includes(id)) ? suggestion : null
  })
  return { ...context, result }
}
