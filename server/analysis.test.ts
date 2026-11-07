import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from './app.ts'
import { demoEngine, profileDecision, profileDiscussion, profilePr, profileTask } from './analysis/demo.ts'
import { explainImpact, suggestDecisionLink } from './analysis/service.ts'

const impactInput = { task: profileTask, pr: profilePr }

test('F3 returns a labeled, task-specific suggestion with an action and inspectable evidence', async () => {
  const { lifecycle, result } = await explainImpact(impactInput, demoEngine)
  assert.equal(lifecycle, 'open')
  assert.equal(result.status, 'suggested')
  assert.equal(result.generatedBy, 'scripted_demo')
  assert.match(result.suggestion.summary, /retains user_name/)
  assert.match(result.suggestion.nextAction, /Inspect the diff/)
  assert.deepEqual(result.suggestion.evidenceIds, [profileTask.dependency.evidenceId, profilePr.activity.id])
})

test('F3 skips analysis when a diff is missing, incomplete, or unrelated to the task', async () => {
  const engine = { ...demoEngine, impact: async () => assert.fail('unexpected engine call') }
  for (const pr of [
    { ...profilePr, diff: undefined },
    { ...profilePr, diff: { text: 'partial patch', complete: false } },
    { ...profilePr, endpoints: ['GET /products'] },
  ]) {
    const { result } = await explainImpact({ ...impactInput, pr }, engine)
    assert.equal(result.status, 'uncertain')
    assert.equal(result.reason, 'insufficient_evidence')
  }
})

test('F4 cites both sources and keeps a proposed link separate from the Slack decision status', async () => {
  for (const decision of [profileDiscussion, profileDecision]) {
    const { decisionStatus, result } = await suggestDecisionLink({ ...impactInput, decision }, demoEngine)
    assert.equal(decisionStatus, decision.status)
    assert.equal(result.status, 'suggested')
    assert.equal(result.generatedBy, 'scripted_demo')
    assert.deepEqual(result.suggestion.evidenceIds, [profilePr.activity.id, decision.messages[0]!.id])
  }
})

test('F4 rejects a one-sided or fabricated citation and ignores engine-supplied decision status', async () => {
  for (const evidenceIds of [[profilePr.activity.id], [profilePr.activity.id, 'invented']]) {
    const engine = { ...demoEngine, link: async () => ({ summary: 'Claim', evidenceIds, decisionStatus: 'confirmed' }) }
    const { decisionStatus, result } = await suggestDecisionLink({ ...impactInput, decision: profileDiscussion }, engine)
    assert.equal(decisionStatus, 'unresolved')
    assert.equal(result.status, 'uncertain')
    assert.equal(result.reason, 'invalid_output')
  }
})

test('an unavailable engine keeps PR and mapping evidence accessible', async () => {
  const engine = { ...demoEngine, impact: async () => { throw new Error('offline') } }
  const { result } = await explainImpact(impactInput, engine)
  assert.deepEqual(result, {
    status: 'uncertain',
    reason: 'engine_unavailable',
    evidenceIds: [profileTask.dependency.evidenceId, profilePr.activity.id],
  })
})

test('sample HTTP endpoints return resolvable evidence without live providers', async () => {
  const app = createApp({})
  try {
    const impact = await app.inject('/api/demo/analysis/profile/impact')
    assert.equal(impact.statusCode, 200)
    const { analysis, evidence: impactEvidence } = impact.json()
    assert.equal(analysis.result.generatedBy, 'scripted_demo')
    for (const id of analysis.result.suggestion.evidenceIds) {
      assert.ok(impactEvidence.some((item: { id: string }) => item.id === id))
    }

    const links = await app.inject('/api/demo/analysis/profile/decision-links')
    assert.equal(links.statusCode, 200)
    const { analyses, evidence: linkEvidence } = links.json()
    assert.deepEqual(analyses.map((item: { decisionStatus: string }) => item.decisionStatus), ['confirmed', 'unresolved'])
    for (const { result } of analyses) {
      assert.equal(result.generatedBy, 'scripted_demo')
      for (const id of result.suggestion.evidenceIds) {
        assert.ok(linkEvidence.some((item: { id: string }) => item.id === id))
      }
    }
  } finally {
    await app.close()
  }
})
