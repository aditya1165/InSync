import type { explainImpact, suggestDecisionLink } from '../../server/analysis/service.ts'
import { demoActivities } from './demo.ts'

export type Evidence = { id: string; title: string; body: string }
type Impact = { analysis: Awaited<ReturnType<typeof explainImpact>>; evidence: Evidence[] }
type DecisionLinks = { analyses: Awaited<ReturnType<typeof suggestDecisionLink>>[]; evidence: Evidence[] }

const profileTask = { id: 'FE-12', name: 'Profile Settings', endpoint: 'GET /users/:id' }
const catalogTask = { id: 'FE-21', name: 'Product Catalog', endpoint: 'GET /products' }

interface Candidate {
  prNumber: number
  title: string
  lifecycle: 'open' | 'draft'
  endpoint: string
  change: string
  priorityReason: string
  impact: Impact
  links: DecisionLinks
}

async function loadSample<T>(path: 'impact' | 'decision-links'): Promise<T> {
  const response = await fetch(`/api/demo/analysis/profile/${path}`)
  if (!response.ok) throw new Error('Sample analysis is unavailable.')
  return response.json() as Promise<T>
}

function paginationPreview(): Candidate {
  const activity = demoActivities(new Date(), 'en-US')
  const pr = activity.find((item) => item.id === 'github-pagination-pr')!
  const discussion = activity.find((item) => item.id === 'slack-pagination-decision')!
  const review = activity.find((item) => item.id === 'github-pagination-review')!
  const mapping = {
    id: 'demo:mapping:catalog',
    title: 'Task dependency · Product Catalog',
    body: 'The Product Catalog uses GET /products with the page_number parameter.',
  }
  const prEvidence = { id: pr.id, title: 'GitHub sample · Draft PR #14', body: pr.body }

  return {
    prNumber: 14,
    title: 'Prototype cursor pagination',
    lifecycle: 'draft',
    endpoint: 'GET /products',
    change: 'Draft PR #14 explores cursor pagination for the product list.',
    priorityReason: 'Worth monitoring. The draft touches your catalog API, and the migration is still undecided.',
    impact: {
      analysis: {
        taskId: catalogTask.id,
        prId: pr.id,
        lifecycle: 'draft',
        result: {
          status: 'suggested',
          generatedBy: 'scripted_demo',
          suggestion: {
            summary: 'Product Catalog may need pagination changes if cursor pagination replaces page_number. The draft leaves compatibility open.',
            nextAction: 'Check the migration plan with the backend team before changing catalog pagination.',
            evidenceIds: [mapping.id, pr.id, review.id],
          },
        },
      },
      evidence: [mapping, prEvidence, { id: review.id, title: 'GitHub sample · Pagination review', body: review.body }],
    },
    links: {
      analyses: [{
        taskId: catalogTask.id,
        prId: pr.id,
        decisionStatus: 'unresolved',
        result: {
          status: 'suggested',
          generatedBy: 'scripted_demo',
          suggestion: {
            summary: 'The planning discussion and draft PR #14 both explore cursor pagination. The team is still reviewing the API contract.',
            evidenceIds: [discussion.id, pr.id],
          },
        },
      }],
      evidence: [prEvidence, { id: discussion.id, title: 'Slack sample · Pagination proposal in API planning', body: discussion.body }],
    },
  }
}

export async function loadTaskCatchUp() {
  const [impact, links] = await Promise.all([
    loadSample<Impact>('impact'),
    loadSample<DecisionLinks>('decision-links'),
  ])

  const profile: Candidate = {
    prNumber: 18,
    title: 'Add display_name to profile response',
    lifecycle: 'open',
    endpoint: 'GET /users/:id',
    change: 'Open PR #18 adds display_name and keeps user_name.',
    priorityReason: 'Review first. The open PR changes the API response your Profile Settings task already reads.',
    impact,
    links,
  }

  const assignedTasks = [profileTask, catalogTask]
  // Open API changes rank ahead of exploratory drafts with an assigned dependency.
  const priority = { open: 0, draft: 1 }
  return [paginationPreview(), profile]
    .flatMap((candidate) => assignedTasks
      .filter((task) => task.endpoint === candidate.endpoint && task.id === candidate.impact.analysis.taskId)
      .map((task) => ({ ...candidate, task })))
    .sort((a, b) => priority[a.lifecycle] - priority[b.lifecycle])
}
