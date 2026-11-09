import assert from 'node:assert/strict'
import { test } from 'node:test'
import { samplePagination } from '../../server/real-demo/analysis.ts'
import { emptyWalkthrough, scenarioRecords, walkthroughReducer } from './walkthrough.ts'
const result = samplePagination(new Date('2026-11-01'), new Date('2026-11-09'))
test('one result holds review outcomes independently of source truth, including correction, undo and reset', () => {
  let state = walkthroughReducer(emptyWalkthrough, { type: 'loaded', result })
  for (const review of [{ state: 'confirmed' }, { state: 'rejected' }, { state: 'deferred' }, { state: 'corrected', correctedMessageId: result.messages[0]!.id }, { state: 'pending' }] as const) {
    state = walkthroughReducer(state, { type: 'review', review })
    assert.deepEqual(state.review, review)
    assert.equal(state.result, result)
    assert.equal(state.result?.decision.status, 'confirmed')
    assert.equal(state.result?.pr.lifecycle, 'open')
  }
  assert.throws(() => walkthroughReducer(state, { type: 'review', review: { state: 'corrected', correctedMessageId: 'invented' } }), /inspectable/)
  state = walkthroughReducer(state, { type: 'why' }); assert.equal(state.why, true)
  assert.deepEqual(walkthroughReducer(state, { type: 'reset' }), emptyWalkthrough)
  assert.equal(walkthroughReducer(state, { type: 'loaded', result }).review.state, 'pending')
})
test('scenario feed reuses source IDs and actual timestamps, filters provider, includes start and excludes end', () => {
  const original = { ...result, pr: { ...result.pr, timestamp: '2026-11-02T00:00:00.000Z' }, window: { start: '2026-11-02T00:00:00.000Z', end: '2026-11-03T00:00:00.000Z' }, messages: [
    { ...result.messages[0]!, timestamp: '2026-11-02T00:00:00.000Z' }, { ...result.messages[1]!, timestamp: '2026-11-03T00:00:00.000Z' },
  ] }
  assert.deepEqual(scenarioRecords(original, 'slack').map((s) => s.id), [original.messages[0]!.id])
  assert.equal(scenarioRecords(original, 'github')[0]?.id, original.pr.id)
  assert.equal(scenarioRecords(original).length, 2)
  assert.equal(scenarioRecords(original, 'slack')[0]?.timestamp, original.messages[0]!.timestamp)
})
