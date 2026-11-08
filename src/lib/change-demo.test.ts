import assert from 'node:assert/strict'
import test from 'node:test'
import { diffLineKind, exampleChangesForImpact } from './change-demo.ts'
import type { DemoImpactResponse } from './task-demo.ts'

const impact: DemoImpactResponse = {
  taskId: 'FE-12',
  status: 'impact_detected',
  uncertainty: false,
  explanation: 'Sample explanation',
  recommendedActions: [],
  generatedBy: 'scripted_demo',
  pr: {
    id: 'sample:github:pr:18',
    number: 18,
    title: 'Change profile name',
    status: 'open',
    endpoint: 'GET /users/id',
    diff: '@@ -1 +1 @@\n-  "user_name": "alex"\n+  "display_name": "Alex"',
    description: 'Sample profile change',
  },
  evidenceIds: ['sample:github:pr:18'],
  evidence: [{ id: 'sample:github:pr:18', title: 'PR #18', source: 'github', body: 'Sample diff' }],
}

test('example change review supports multiple proposals, files, and inspectable sources', () => {
  const changes = exampleChangesForImpact(impact)
  assert.deepEqual(changes.map((change) => change.number), [18, 21])
  assert.deepEqual(changes[1]?.files.map((file) => file.path), ['api/users.json', 'docs/profile.md'])
  for (const change of changes) {
    assert.ok(change.evidence.some((record) => record.id === change.id))
    assert.ok(change.files.every((file) => file.patch.includes('@@')))
  }
  assert.equal(diffLineKind('+ added'), 'added')
  assert.equal(diffLineKind('- removed'), 'removed')
  assert.equal(diffLineKind('@@ -1 +1 @@'), 'context')
})

test('uncertain task context does not invent changes', () => {
  assert.deepEqual(exampleChangesForImpact({ ...impact, impactUncertain: true }), [])
})
