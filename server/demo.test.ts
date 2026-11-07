import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.ts'

test('GET /api/demo/impact requires taskId and returns 400 for missing or blank taskId', async () => {
  const app = createApp({})
  try {
    // Missing taskId query param
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/demo/impact',
    })
    assert.equal(res1.statusCode, 400)
    assert.deepEqual(res1.json(), {
      error: 'Limited task context: Please select an assigned task.',
    })

    // Blank taskId query param
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/demo/impact?taskId=   ',
    })
    assert.equal(res2.statusCode, 400)
    assert.deepEqual(res2.json(), {
      error: 'Limited task context: Please select an assigned task.',
    })
  } finally {
    await app.close()
  }
})

test('GET /api/demo/impact returns mock AI explanation and 3 recommended actions for Sameer profile task', async () => {
  const app = createApp({})
  try {
    // Seeded task UUID
    const res = await app.inject({
      method: 'GET',
      url: '/api/demo/impact?taskId=d0000000-0000-4000-8000-000000000001',
    })
    assert.equal(res.statusCode, 200)
    const data = res.json()
    assert.equal(data.status, 'impact_detected')
    assert.equal(data.uncertainty, false)
    assert.equal(
      data.explanation,
      'The response field user_name is replaced by display_name. This may affect the profile component data mapping.',
    )
    assert.deepEqual(data.recommendedActions, [
      'Update API call mapping',
      'Check response fields',
      'Run integration check',
    ])
    assert.equal(data.pr.number, 18)
    assert.equal(data.pr.title, 'Update user profile API response')
    assert.match(data.pr.diff, /- {2}"user_name": "string"/)
    assert.match(data.pr.diff, /\+ {2}"display_name": "string"/)

    // Also support alias FE-12
    const resAlias = await app.inject({
      method: 'GET',
      url: '/api/demo/impact?taskId=FE-12',
    })
    assert.equal(resAlias.statusCode, 200)
    assert.equal(resAlias.json().status, 'impact_detected')
  } finally {
    await app.close()
  }
})

test('GET /api/demo/impact returns impact uncertain and empty recommendations for unknown taskId', async () => {
  const app = createApp({})
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/api/demo/impact?taskId=unknown-task-999',
    })
    assert.equal(res.statusCode, 200)
    const data = res.json()
    assert.equal(data.status, 'uncertain')
    assert.equal(data.impactUncertain, true)
    assert.equal(data.uncertainty, true)
    assert.match(data.explanation, /Impact uncertain/i)
    assert.deepEqual(data.recommendedActions, [])
    assert.deepEqual(data.evidenceIds, [])
  } finally {
    await app.close()
  }
})

test('GET /api/demo/decisions returns confirmed truth link and planted evaluation trap', async () => {
  const app = createApp({})
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/api/demo/decisions',
    })
    assert.equal(res.statusCode, 200)
    const data = res.json()
    assert.equal(data.generatedBy, 'scripted_demo')
    assert.equal(data.decisions.length, 2)

    // Match 1: The Truth
    const truth = data.decisions.find((d: { isTrap: boolean }) => !d.isTrap)
    assert.ok(truth)
    assert.equal(truth.confidence, 'high')
    assert.equal(truth.decisionStatus, 'confirmed')
    assert.equal(truth.statusLabel, 'Confirmed')
    assert.match(truth.slackMessage, /We are officially deprecating user_name/)

    // Match 2: The Evaluation Trap
    const trap = data.decisions.find((d: { isTrap: boolean }) => d.isTrap)
    assert.ok(trap)
    assert.equal(trap.confidence, 'low')
    assert.equal(trap.decisionStatus, 'unresolved')
    assert.equal(trap.statusLabel, 'Not a verified fact / Impact uncertain')
    assert.match(trap.slackMessage, /Should we consider adding an email_verified boolean/)
  } finally {
    await app.close()
  }
})
