import assert from 'node:assert/strict'
import test from 'node:test'
import { getTimeWindow, isInWindow, previousCalendarWeek } from './time.ts'

test('previous calendar week respects the viewer locale', () => {
  const friday = new Date(2026, 10, 6, 14, 30)

  const us = previousCalendarWeek(friday, 'en-US')
  assert.deepEqual(
    [us.start.getFullYear(), us.start.getMonth(), us.start.getDate()],
    [2026, 9, 25],
  )
  assert.deepEqual(
    [us.end.getFullYear(), us.end.getMonth(), us.end.getDate()],
    [2026, 10, 1],
  )

  const gb = previousCalendarWeek(friday, 'en-GB')
  assert.deepEqual(
    [gb.start.getFullYear(), gb.start.getMonth(), gb.start.getDate()],
    [2026, 9, 26],
  )
  assert.deepEqual(
    [gb.end.getFullYear(), gb.end.getMonth(), gb.end.getDate()],
    [2026, 10, 2],
  )
})

test('last 24 hours uses a rolling 24-hour interval', () => {
  const now = new Date('2026-11-06T20:00:00.000Z')
  const window = getTimeWindow('last24Hours', now, 'en-US', null)
  assert.ok(window)
  assert.equal(window.end.getTime() - window.start.getTime(), 24 * 60 * 60 * 1000)
})

test('since last catch-up begins only after a successful catch-up exists', () => {
  const now = new Date('2026-11-06T20:00:00.000Z')
  assert.equal(getTimeWindow('sinceLastCatchUp', now, 'en-US', null), null)

  const completedAt = new Date('2026-11-06T18:00:00.000Z')
  const window = getTimeWindow('sinceLastCatchUp', now, 'en-US', completedAt)
  assert.equal(window?.start, completedAt)
  assert.equal(window?.end, now)
})

test('activity range includes its start and excludes its end', () => {
  const window = {
    start: new Date('2026-11-01T00:00:00.000Z'),
    end: new Date('2026-11-08T00:00:00.000Z'),
  }
  assert.equal(isInWindow('2026-11-01T00:00:00.000Z', window), true)
  assert.equal(isInWindow('2026-11-08T00:00:00.000Z', window), false)
})
