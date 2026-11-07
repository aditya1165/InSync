import { isDeepStrictEqual } from 'node:util'
import type { AnalysisEngine, DecisionEvidence, PullRequestEvidence, TaskContext } from './service.ts'

const occurredAt = '2026-11-06T22:00:00Z'

export const profileTask: TaskContext = {
  id: 'FE-12',
  component: 'ProfileSettings',
  dependency: {
    evidenceId: 'demo:mapping:profile',
    endpoint: 'GET /users/:id',
    usedFields: ['user_name'],
  },
}

export const profilePr: PullRequestEvidence = {
  activity: {
    id: 'demo:github:pr:18',
    kind: 'github_pull_request',
    source: 'github',
    occurredAt,
    actor: 'Demo backend developer',
    location: 'Sample repository / PR #18',
    title: 'Add display_name to profile response',
    body: 'Add display_name while retaining user_name.',
  },
  lifecycle: 'open',
  endpoints: ['GET /users/:id'],
  diff: {
    complete: true,
    text: '@@ -1,3 +1,4 @@\n return {\n   user_name: user.username,\n+  display_name: user.displayName,\n };',
  },
}

export const profileDiscussion: DecisionEvidence = {
  status: 'unresolved',
  messages: [{
    id: 'demo:slack:profile:discussion',
    kind: 'slack_thread',
    source: 'slack',
    occurredAt,
    actor: 'Demo teammate',
    location: 'Sample #backend-api',
    title: 'Profile response field discussion',
    body: 'Could we add display_name? Let’s check compatibility before deciding whether to remove user_name.',
  }],
}

export const profileDecision: DecisionEvidence = {
  status: 'confirmed',
  messages: [{
    ...profileDiscussion.messages[0]!,
    id: 'demo:slack:profile:decision',
    title: 'Profile compatibility decision',
    body: 'Decision recorded: add display_name and keep user_name for compatibility. PR #18 implements the agreed addition.',
  }],
}

export const demoEngine: AnalysisEngine = {
  generatedBy: 'scripted_demo',
  async impact({ task, pr }) {
    if (!isDeepStrictEqual(task, profileTask) || !isDeepStrictEqual(pr, profilePr)) return null
    return {
      summary: 'Open PR #18 adds display_name and retains user_name, which ProfileSettings currently reads.',
      nextAction: 'Inspect the diff and verify the existing user_name behavior with the proposed response.',
      evidenceIds: [task.dependency.evidenceId, pr.activity.id],
    }
  },
  async link({ task, pr, decision }) {
    if (!isDeepStrictEqual(task, profileTask) || !isDeepStrictEqual(pr, profilePr)) return null
    if (isDeepStrictEqual(decision, profileDecision)) {
      return {
        summary: 'The recorded compatibility decision explicitly names PR #18.',
        evidenceIds: [pr.activity.id, ...decision.messages.map((message) => message.id)],
      }
    }
    if (isDeepStrictEqual(decision, profileDiscussion)) {
      return {
        summary: 'Possible match. Both sources mention display_name and user_name. The Slack discussion leaves removal unresolved.',
        evidenceIds: [pr.activity.id, ...decision.messages.map((message) => message.id)],
      }
    }
    return null
  },
}
