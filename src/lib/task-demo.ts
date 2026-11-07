// Client API fetchers for InSync ASN-04 Demo
// Connects to Fastify routes /api/demo/impact and /api/demo/decisions

export interface EvidenceRecord {
  id: string
  title: string
  source?: string
  location?: string
  body: string
}

export interface DemoImpactResponse {
  taskId: string
  taskTitle?: string
  component?: string
  status: 'impact_detected' | 'uncertain'
  uncertainty: boolean
  impactUncertain?: boolean
  reason?: string
  explanation: string
  recommendedActions: string[]
  pr?: {
    id: string
    number: number
    title: string
    status: string
    endpoint: string
    diff: string
    description: string
  }
  evidenceIds: string[]
  evidence?: EvidenceRecord[]
  generatedBy: string
  confidence?: string
  confidenceScore?: number
  error?: string
}

export interface DecisionItem {
  id: string
  decisionId: string
  prId: string
  channel: string
  slackMessage: string
  prTitle: string
  confidence: 'high' | 'low'
  confidenceScore: number
  decisionStatus: 'confirmed' | 'unresolved' | 'proposed'
  linkStatus: 'confirmed' | 'uncertain'
  statusLabel: string
  matchRationale: string
  evidenceIds: string[]
  isTrap: boolean
  author: string
  occurredAt: string
}

export interface DemoDecisionsResponse {
  generatedBy: string
  decisions: DecisionItem[]
  evidence: EvidenceRecord[]
}

// Fetch F3 Task Impact Explanation
export async function fetchDemoImpact(
  taskId?: string,
  options?: { endpoint?: string; taskTitle?: string; component?: string },
): Promise<DemoImpactResponse> {
  const params = new URLSearchParams()
  if (taskId) params.set('taskId', taskId)
  if (options?.endpoint) params.set('endpoint', options.endpoint)
  if (options?.taskTitle) params.set('taskTitle', options.taskTitle)
  if (options?.component) params.set('component', options.component)

  const queryString = params.toString()
  const url = queryString ? `/api/demo/impact?${queryString}` : '/api/demo/impact'
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    return {
      taskId: taskId || '',
      status: 'uncertain',
      uncertainty: true,
      impactUncertain: true,
      explanation: data.error || 'Failed to fetch task impact.',
      recommendedActions: [],
      evidenceIds: [],
      generatedBy: 'error_fallback',
      error: data.error,
    }
  }
  return data as DemoImpactResponse
}

// Fetch F4 Decision-to-PR Connections (with Confirmed Truth & Evaluation Trap)
export async function fetchDemoDecisions(): Promise<DemoDecisionsResponse> {
  const res = await fetch('/api/demo/decisions')
  if (!res.ok) {
    throw new Error('Failed to load demo decision links.')
  }
  return res.json() as Promise<DemoDecisionsResponse>
}

// Backward-compatible loader for older catch-up preview widgets if needed
export async function loadTaskCatchUp() {
  const [impactData, decisionsData] = await Promise.all([
    fetchDemoImpact('d0000000-0000-4000-8000-000000000001'),
    fetchDemoDecisions(),
  ])

  return [
    {
      prNumber: 18,
      title: 'Update user profile API response',
      lifecycle: 'open' as const,
      endpoint: 'GET /users/id',
      change: 'Breaking change: field user_name is replaced by display_name.',
      priorityReason: 'Critical. Breaking field deprecation directly affects assigned ProfileSettings component.',
      task: {
        id: 'FE-12',
        name: 'Profile Settings (Sameer)',
        endpoint: 'GET /users/id',
      },
      impactData,
      decisionsData,
      impact: {
        analysis: {
          taskId: 'FE-12',
          prId: 'demo:github:pr:18',
          lifecycle: 'open' as const,
          result: {
            status: 'suggested' as const,
            generatedBy: 'scripted_demo' as const,
            suggestion: {
              summary: impactData.explanation,
              nextAction: impactData.recommendedActions[0] || 'Update API call mapping',
              evidenceIds: impactData.evidenceIds,
            },
          },
        },
        evidence: impactData.evidence?.map((e) => ({ id: e.id, title: e.title, body: e.body })) || [],
      },
      links: {
        analyses: decisionsData.decisions.map((d) => ({
          taskId: 'FE-12',
          prId: d.prId,
          decisionStatus: d.decisionStatus,
          result: {
            status: 'suggested' as const,
            generatedBy: 'scripted_demo' as const,
            suggestion: {
              summary: d.matchRationale,
              evidenceIds: d.evidenceIds,
            },
          },
        })),
        evidence: decisionsData.evidence.map((e) => ({ id: e.id, title: e.title, body: e.body })),
      },
    },
  ]
}
