// Hardcoded Backend Fixtures (The Source Data for InSync ASN-04 Demo)
// Default Authenticated User: Sameer
// External content is maintained strictly in memory - never persisted in DB.

export interface DemoTask {
  id: string
  title: string
  component: string
  status: 'in_progress' | 'todo' | 'done'
  dependency: {
    evidenceId: string
    endpoint: string
    usedFields: readonly string[]
  }
}

export interface DemoPullRequest {
  id: string
  number: number
  title: string
  status: 'open' | 'draft' | 'merged'
  endpoint: string
  diff: string
  description: string
  author: string
  occurredAt: string
}

export interface DemoDecisionLink {
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

export const sameerTask: DemoTask = {
  id: 'd0000000-0000-4000-8000-000000000001',
  title: 'Build profile settings component',
  component: 'ProfileSettings',
  status: 'in_progress',
  dependency: {
    evidenceId: 'demo:mapping:profile-settings',
    endpoint: 'GET /users/id',
    usedFields: ['user_name'],
  },
}

// Support alias for task ID "FE-12" or "task-sameer-profile"
export const isSameerTaskId = (taskId: string): boolean => {
  const normalized = taskId.trim().toLowerCase()
  return (
    normalized === sameerTask.id.toLowerCase() ||
    normalized === 'fe-12' ||
    normalized === 'task-sameer-profile' ||
    normalized === 'profilesettings'
  )
}

export const demoPullRequest: DemoPullRequest = {
  id: 'demo:github:pr:18',
  number: 18,
  title: 'Update user profile API response',
  status: 'open',
  endpoint: 'GET /users/id',
  diff: `@@ -1,4 +1,4 @@
 {
   "id": "123",
-  "user_name": "string",
+  "display_name": "string"
 }`,
  description: 'Breaking change: replaces user_name with display_name on GET /users/id',
  author: 'Backend Team',
  occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
}

// Slack Thread 1: The Ground Truth (Confirmed Decision)
export const demoSlackTruth: DemoDecisionLink = {
  id: 'dec-link-1',
  decisionId: 'demo:slack:thread:truth',
  prId: demoPullRequest.id,
  channel: '#backend-api',
  slackMessage:
    'Decision: We are officially deprecating user_name. Use display_name in the profile API response moving forward.',
  prTitle: demoPullRequest.title,
  confidence: 'high',
  confidenceScore: 0.98,
  decisionStatus: 'confirmed',
  linkStatus: 'confirmed',
  statusLabel: 'Confirmed',
  matchRationale:
    'The Slack decision explicitly states deprecation of user_name and adoption of display_name, directly matching the breaking diff in PR #18.',
  evidenceIds: [demoPullRequest.id, 'demo:slack:thread:truth'],
  isTrap: false,
  author: 'Backend Lead',
  occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
}

// Slack Thread 2: The Planted Evaluation Trap (Unresolved Proposal)
export const demoSlackTrap: DemoDecisionLink = {
  id: 'dec-link-2',
  decisionId: 'demo:slack:thread:trap',
  prId: demoPullRequest.id,
  channel: '#backend-api',
  slackMessage:
    'Should we consider adding an email_verified boolean to the profile response next week?',
  prTitle: demoPullRequest.title,
  confidence: 'low',
  confidenceScore: 0.32,
  decisionStatus: 'unresolved',
  linkStatus: 'uncertain',
  statusLabel: 'Not a verified fact / Impact uncertain',
  matchRationale:
    'Unresolved proposal regarding email_verified boolean; not verified against the current profile PR diff.',
  evidenceIds: [demoPullRequest.id, 'demo:slack:thread:trap'],
  isTrap: true,
  author: 'Product Teammate',
  occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
}

export const demoEvidenceRecords = [
  {
    id: sameerTask.dependency.evidenceId,
    title: 'Task Dependency Mapping (Feature F2)',
    source: 'task_mapping',
    location: 'ProfileSettings ↔ GET /users/id',
    body: 'Component ProfileSettings reads field "user_name" from endpoint GET /users/id.',
  },
  {
    id: demoPullRequest.id,
    title: `GitHub PR #${demoPullRequest.number} · ${demoPullRequest.title}`,
    source: 'github',
    location: 'demo-api / pull requests',
    body: demoPullRequest.diff,
  },
  {
    id: demoSlackTruth.decisionId,
    title: `Slack Thread · Confirmed Decision (${demoSlackTruth.channel})`,
    source: 'slack',
    location: `${demoSlackTruth.channel} · 4 replies`,
    body: demoSlackTruth.slackMessage,
  },
  {
    id: demoSlackTrap.decisionId,
    title: `Slack Thread · Unresolved Proposal (${demoSlackTrap.channel})`,
    source: 'slack',
    location: `${demoSlackTrap.channel} · 2 replies`,
    body: demoSlackTrap.slackMessage,
  },
]
