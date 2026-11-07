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
  endpoint?: string
  taskTitle?: string
  component?: string
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
      const endpoint = request.query.endpoint?.trim()
      const customTitle = request.query.taskTitle?.trim()
      const customComponent = request.query.component?.trim()

      // Edge Case 1: Missing taskId -> 400 Bad Request
      if (!taskId) {
        reply.code(400).send({
          error: 'Limited task context: Please select an assigned task.',
        })
        return
      }

      // Check if task maps to the breaking PR endpoint GET /users/id
      const mapsToBreakingEndpoint =
        endpoint === 'GET /users/id' ||
        endpoint === 'GET /users/:id' ||
        isSameerTaskId(taskId)

      if (mapsToBreakingEndpoint) {
        const title = customTitle || sameerTask.title
        const component = customComponent || sameerTask.component

        return reply.code(200).send({
          taskId,
          taskTitle: title,
          component,
          status: 'impact_detected',
          uncertainty: false,
          explanation: customComponent
            ? `The response field user_name is replaced by display_name. This may affect the ${customComponent} component data mapping.`
            : 'The response field user_name is replaced by display_name. This may affect the profile component data mapping.',
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

      // Edge Case 2: Unknown or unmapped task context -> 200 with impact uncertain
      return reply.code(200).send({
        taskId,
        status: 'uncertain',
        impactUncertain: true,
        uncertainty: true,
        reason: 'Unknown or unmapped task context. Impact uncertain.',
        explanation: endpoint
          ? `Impact uncertain: No known open pull requests affect endpoint ${endpoint}.`
          : 'Impact uncertain: No known API dependency mapping found for this task.',
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
