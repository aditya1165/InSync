import type { FastifyInstance } from 'fastify'
import { demoEngine, profileDecision, profileDiscussion, profilePr, profileTask } from './demo.ts'
import { explainImpact, suggestDecisionLink } from './service.ts'

export function registerAnalysisDemo(app: FastifyInstance) {
  const input = { task: profileTask, pr: profilePr }

  app.get('/api/demo/analysis/profile/impact', async () => ({
    analysis: await explainImpact(input, demoEngine),
    evidence: [
      { id: profileTask.dependency.evidenceId, title: 'Task dependency', body: 'ProfileSettings → GET /users/:id. The component reads user_name.' },
      { id: profilePr.activity.id, title: 'GitHub sample · PR #18 diff', body: profilePr.diff!.text },
    ],
  }))

  app.get('/api/demo/analysis/profile/decision-links', async () => {
    const decisions = [profileDecision, profileDiscussion]
    return {
      analyses: await Promise.all(decisions.map((decision) => suggestDecisionLink({ ...input, decision }, demoEngine))),
      evidence: [
        { id: profilePr.activity.id, title: 'GitHub sample · PR #18', body: profilePr.activity.body },
        ...decisions.flatMap((decision) => decision.messages.map((message) => ({
          id: message.id, title: `Slack sample · ${message.title}`, body: message.body,
        }))),
      ],
    }
  })
}
