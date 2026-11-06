import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatchUp, filterSupportedInsights, type Activity, type Insight } from './catchup.ts'
import { createDemoProvider, demoAnalyzer } from './demo.ts'
import { getTimeWindow } from './time.ts'

test('every demo highlight has evidence in the selected range', async () => {
  const now = new Date(2026, 10, 6, 14, 30)
  const window = getTimeWindow('previousWeek', now, 'en-US', null)
  assert.ok(window)

  const result = await createCatchUp(window, createDemoProvider(now, 'en-US'), demoAnalyzer)
  const ids = new Set(result.activities.map((activity) => activity.id))
  assert.ok(result.activities.length > 0)
  assert.ok(result.insights.length > 0)
  for (const insight of result.insights) {
    assert.ok(insight.evidenceIds.every((id) => ids.has(id)), insight.id)
  }
  assert.ok(result.insights.some((item) => item.category === 'possible_decision'))
})

test('highlights with missing evidence are removed', () => {
  const activities = [{ id: 'present' }] as Activity[]
  const insights = [
    { id: 'supported', evidenceIds: ['present'] },
    { id: 'unsupported', evidenceIds: ['missing'] },
    { id: 'empty', evidenceIds: [] },
  ] as Insight[]

  assert.deepEqual(
    filterSupportedInsights(insights, activities).map((item) => item.id),
    ['supported'],
  )
})
