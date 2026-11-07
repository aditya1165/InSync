import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  demoEvidenceRecords,
  demoPullRequest,
  demoSlackTrap,
  demoSlackTruth,
  isSameerTaskId,
  sameerTask,
} from '../fixtures/demoScenario.ts'

export interface DemoImpactQuery {
  taskId?: string
}

export function registerDemoRoutes(app: FastifyInstance) {
  // Feature F3: Task-Aware AI Impact Explanation
  app.get(
    '/api/demo/impact',
    async (
      request: FastifyRequest<{ Querystring: DemoImpactQuery }>,
      reply: FastifyReply,
    ) => {
      const taskId = request.query.taskId?.trim()

      // Edge Case 1: Missing taskId -> 400 Bad Request
      if (!taskId) {
        reply.code(400).send({
          error: 'Limited task context: Please select an assigned task.',
        })
        return
      }

      // Matching Task: Sameer's seeded task
      if (isSameerTaskId(taskId)) {
        return reply.code(200).send({
          taskId: sameerTask.id,
          taskTitle: sameerTask.title,
          component: sameerTask.component,
          status: 'impact_detected',
          uncertainty: false,
          explanation:
            'The response field user_name is replaced by display_name. This may affect the profile component data mapping.',
          recommendedActions: [
            'Update API call mapping',
            'Check response fields',
            'Run integration check',
          ],
          pr: {
            id: demoPullRequest.id,
            number: demoPullRequest.number,
            title: demoPullRequest.title,
            status: demoPullRequest.status,
            endpoint: demoPullRequest.endpoint,
            diff: demoPullRequest.diff,
            description: demoPullRequest.description,
          },
          evidenceIds: [
            sameerTask.dependency.evidenceId,
            demoPullRequest.id,
          ],
          evidence: demoEvidenceRecords.filter((record) =>
            [sameerTask.dependency.evidenceId, demoPullRequest.id].includes(record.id),
          ),
          generatedBy: 'scripted_demo',
          confidence: 'high',
          confidenceScore: 0.98,
        })
      }

      // Edge Case 2: Unknown taskId -> 200 with impact uncertain flag & empty recommendations
      return reply.code(200).send({
        taskId,
        status: 'uncertain',
        impactUncertain: true,
        uncertainty: true,
        reason: 'Unknown or unmapped task context. Impact uncertain.',
        explanation:
          'Impact uncertain: No known API dependency mapping found for this task.',
        recommendedActions: [],
        evidenceIds: [],
        evidence: [],
        generatedBy: 'scripted_demo',
        confidence: 'unknown',
        confidenceScore: 0.0,
      })
    },
  )

  // Feature F4: Decision-to-PR Connection (with Confirmed Truth & Planted Trap)
  app.get('/api/demo/decisions', async () => {
    return {
      generatedBy: 'scripted_demo',
      decisions: [demoSlackTruth, demoSlackTrap],
      evidence: demoEvidenceRecords,
    }
  })
}
