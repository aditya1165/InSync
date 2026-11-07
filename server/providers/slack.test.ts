import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSlackProvider } from './slack.ts'

const window = { start: new Date('2026-11-05T00:00:00Z'), end: new Date('2026-11-06T00:00:00Z') }
const inside = String(Date.parse('2026-11-05T12:00:00Z') / 1000)
const old = String(Date.parse('2026-11-01T12:00:00Z') / 1000)

function slackFetcher(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input))
  const method = url.pathname.split('/').at(-1)
  let data: unknown
  if (method === 'conversations.history') {
    data = { ok: true, messages: [
      { ts: old, text: 'Old parent', user: 'U1', reply_count: 1, latest_reply: inside },
      { ts: inside, text: 'New message', user: 'U2' },
    ] }
  } else if (method === 'conversations.replies') {
    data = { ok: true, messages: [
      { ts: old, text: 'Old parent', user: 'U1' },
      { ts: `${Number(inside) + 1}`, thread_ts: old, text: 'New reply', user: 'U3' },
    ] }
  } else {
    data = { ok: true, permalink: `https://app.slack.com/archives/C123/p${url.searchParams.get('message_ts')?.replace('.', '')}` }
  }
  return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
}

test('Slack provider includes new replies to older threads with permalinks', async () => {
  const provider = createSlackProvider({ token: 'test-token', channels: [{ id: 'C123', name: 'general' }] }, slackFetcher as typeof fetch)
  const activities = await provider.list(window)
  assert.equal(activities.length, 2)
  assert.deepEqual(new Set(activities.map((a) => a.kind)), new Set(['slack_message', 'slack_thread']))
  assert.ok(activities.every((a) => a.sourceUrl?.startsWith('https://app.slack.com/archives/C123/')))
  assert.ok(activities.some((a) => a.location === '#general · thread'))
})
