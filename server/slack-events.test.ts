import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import Fastify from 'fastify'
import { SlackThreadCollector } from './slack-events/collector.ts'
import { SlackEventsRuntime } from './slack-events/runtime.ts'
import { registerRealDemo } from './real-demo/routes.ts'

const now = Date.now()
const ts = (offset = 0) => ((now + offset) / 1000).toFixed(6)
const root = ts(-20000)
function envelope(id: string, event: Record<string, unknown>, team = 'T1') {
  return { type: 'event_callback', event_id: id, team_id: team, event: { type: 'message', channel: 'C123', user: 'U1', ts: ts(), ...event } }
}
test('human events are scoped, deduplicated and grouped without retaining message bodies', () => {
  const collector = new SlackThreadCollector('C123', 'T1')
  const first = envelope('Ev1', { ts: root, text: 'PRIVATE SOURCE CONTENT' })
  assert.equal(collector.accept(first, now), 'accepted')
  assert.equal(collector.accept(first, now), 'duplicate')
  assert.equal(collector.accept(envelope('Ev2', { thread_ts: root, user: 'U2', ts: ts(-10000), text: '+1' }), now), 'accepted')
  assert.equal(collector.accept(envelope('Ev3', { channel: 'COTHER' }), now), 'ignored')
  assert.equal(collector.accept(envelope('Ev4', {}, 'TOTHER'), now), 'ignored')
  assert.equal(collector.accept(envelope('Ev5', { bot_id: 'BOT', text: 'staged bot message' }), now), 'ignored')
  assert.equal(collector.accept(envelope('Ev6', { app_id: 'A1' }), now), 'ignored')
  assert.equal(collector.list().length, 1)
  assert.equal(collector.get(root)?.eventCount, 2)
  assert.ok(!JSON.stringify(collector).includes('PRIVATE SOURCE CONTENT'))
  assert.ok(!JSON.stringify(collector.list()).includes('U1'))
})
test('message edits and deletions invalidate the same thread revision; other Slack subtypes are ignored', () => {
  const collector = new SlackThreadCollector('C123', 'T1')
  collector.accept(envelope('Ev1', { ts: root }), now)
  const before = collector.get(root)!.revision
  collector.accept(envelope('Ev2', { subtype: 'message_changed', event_ts: ts(-5000), message: { user: 'U2', ts: ts(-10000), thread_ts: root, text: 'edited' } }), now)
  assert.ok(collector.get(root)!.revision > before)
  const edited = collector.get(root)!.revision
  collector.accept(envelope('Ev3', { subtype: 'message_deleted', event_ts: ts(), deleted_ts: ts(-10000), previous_message: { user: 'U2', ts: ts(-10000), thread_ts: root } }), now)
  assert.ok(collector.get(root)!.revision > edited)
  assert.equal(collector.accept(envelope('Ev4', { subtype: 'channel_join' }), now), 'ignored')
  assert.equal(collector.accept(envelope('Ev5', { subtype: 'message_changed', message: { bot_id: 'B1', user: 'U3', ts: root } }), now), 'ignored')
})
test('event metadata is bounded and rejects invalid timestamps and stale deliveries', () => {
  const collector = new SlackThreadCollector('C123', 'T1', { threads: 2, events: 2 })
  for (let i = 0; i < 4; i++) collector.accept(envelope(`Ev${i}`, { ts: ts(-i * 1000) }), now)
  assert.equal(collector.list().length, 2)
  assert.equal(collector.accept(envelope('Ev9', { ts: 'invalid' }), now), 'ignored')
  assert.equal(collector.accept(envelope('Ev10', { ts: ts(-9 * 86400000) }), now), 'ignored')
  assert.equal(collector.accept({ type: 'url_verification' }, now), 'ignored')
})
const env = { SLACK_EVENTS_ENABLED: 'true', SLACK_APP_TOKEN: 'xapp-TEST_SECRET', SLACK_BOT_TOKEN: 'xoxb-TEST_SECRET',
  GITHUB_OWNER: 'demo', GITHUB_REPO: 'repo', GITHUB_DEMO_ALLOWLIST: 'demo/repo', SLACK_CHANNEL_ID: 'C123', SLACK_DEMO_ALLOWLIST: 'C123' }
class FakeSocket extends EventEmitter {
  starts = 0; stops = 0
  async start() { this.starts++; this.emit('connected') }
  async disconnect() { this.stops++; this.emit('disconnected') }
}
function slackFetch(input: RequestInfo | URL) {
  const method = new URL(String(input)).pathname.split('/').at(-1)
  const body = method === 'auth.test' ? { ok: true, bot_id: 'B1', team_id: 'T1' }
    : { ok: true, channel: { id: 'C123', is_member: true, is_archived: false } }
  return Promise.resolve(new Response(JSON.stringify(body)))
}
test('Socket Mode acknowledges accepted/ignored/retried events and keeps metadata through reconnects', async () => {
  const socket = new FakeSocket()
  const runtime = new SlackEventsRuntime(env, slackFetch as typeof fetch, () => socket)
  await Promise.all([runtime.start(), runtime.start()])
  assert.equal(socket.starts, 1); assert.equal(runtime.snapshot().state, 'connected')
  let acknowledgements = 0
  const packet = { type: 'events_api', body: envelope('Ev1', { ts: root }), ack: async () => { acknowledgements++ } }
  socket.emit('slack_event', packet); socket.emit('slack_event', packet)
  socket.emit('slack_event', { ...packet, body: envelope('Ev2', { channel: 'COTHER' }) })
  await Promise.resolve()
  assert.equal(acknowledgements, 3)
  assert.equal(runtime.snapshot().stats.accepted, 1); assert.equal(runtime.snapshot().stats.duplicate, 1)
  socket.emit('reconnecting'); assert.equal(runtime.snapshot().state, 'reconnecting')
  socket.emit('connected'); assert.equal(runtime.snapshot().threads.length, 1)
  assert.ok(!JSON.stringify(runtime.snapshot()).includes('TEST_SECRET'))
  await runtime.stop(); assert.equal(socket.stops, 1)
})
test('missing credentials, public binds, production and disabled settings do not open sockets', async () => {
  for (const setting of [{ ...env, SLACK_APP_TOKEN: '' }, { ...env, SLACK_EVENTS_ENABLED: 'false' }, { ...env, HOST: '0.0.0.0' }, { ...env, NODE_ENV: 'production' }]) {
    let constructed = false
    const runtime = new SlackEventsRuntime(setting, slackFetch as typeof fetch, () => { constructed = true; return new FakeSocket() })
    await runtime.start(); assert.equal(constructed, false)
  }
})
test('socket startup failures are sanitized and do not make the existing demo unavailable', async () => {
  const socket = new FakeSocket()
  socket.start = async () => { throw new Error('wss://secret.example?token=TEST_SECRET') }
  const runtime = new SlackEventsRuntime(env, slackFetch as typeof fetch, () => socket)
  await runtime.start()
  assert.ok(!JSON.stringify(runtime.snapshot()).includes('TEST_SECRET'))
  const app = Fastify(); registerRealDemo(app, env, slackFetch as typeof fetch, runtime)
  try {
    const status = await app.inject('/api/slack-events/status'); assert.equal(status.statusCode, 200)
    const query = new URLSearchParams({ mode: 'sample', start: '2026-11-01T00:00:00Z', end: '2026-11-09T00:00:00Z' })
    assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 200)
  } finally { await app.close() }
})
test('status endpoints expose metadata locally and refuse production access', async () => {
  const runtime = new SlackEventsRuntime(env, slackFetch as typeof fetch, () => new FakeSocket())
  await runtime.start()
  runtime.collector!.accept(envelope('Ev1', { ts: root, text: 'PRIVATE TEXT' }), now)
  for (const [settings, expected] of [[env, 200], [{ ...env, NODE_ENV: 'production' }, 403]] as const) {
    const app = Fastify(); registerRealDemo(app, settings, slackFetch as typeof fetch, runtime)
    try {
      const response = await app.inject('/api/slack-events/status')
      assert.equal(response.statusCode, expected); assert.ok(!response.body.includes('PRIVATE TEXT'))
    } finally { await app.close() }
  }
  await runtime.stop()
})

test('a deletion without previous_message invalidates a previously indexed human reply', () => {
  const collector = new SlackThreadCollector('C123', 'T1')
  const reply = ts(-10000)
  collector.accept(envelope('Ev1', { ts: reply, thread_ts: root }), now)
  const version = collector.get(root)!.revision
  assert.equal(collector.accept(envelope('Ev2', { subtype: 'message_deleted', user: undefined, event_ts: ts(), deleted_ts: reply, ts: ts() }), now), 'accepted')
  assert.ok(collector.get(root)!.revision > version)
})
