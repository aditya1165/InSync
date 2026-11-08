import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.ts'

const start = '2026-11-05T00:00:00.000Z'
const end = '2026-11-06T00:00:00.000Z'

test('health reports only configured sources', async () => {
  const app = createApp({ github: { async list() { return [] } } })
  const response = await app.inject('/api/health')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    status: 'ok',
    sources: { github: 'configured', slack: 'unconfigured' },
  })
  await app.close()
})

test('activity validates time windows', async () => {
  const app = createApp({ resolveActivityScope: async () => ({ boardId: 'board-1' }) })
  assert.equal((await app.inject('/api/activity')).statusCode, 400)
  assert.equal((await app.inject(`/api/activity?start=${end}&end=${start}`)).statusCode, 400)
  await app.close()
})

test('activity keeps successful source records and reports a source failure', async () => {
  const app = createApp({
    resolveActivityScope: async () => ({
      boardId: 'board-1',
      github: { async list() { return [{
        id: 'github:issue:1', source: 'github', kind: 'github_issue',
        occurredAt: '2026-11-05T12:00:00.000Z', actor: 'a', title: 'Issue',
        body: 'Body', location: 'repo', sourceUrl: 'https://github.com/example/repo/issues/1',
      }] } },
      slack: { async list() { throw new Error('Slack conversations.history failed (missing_scope).') } },
    }),
  })
  const response = await app.inject(`/api/activity?start=${start}&end=${end}`)
  assert.equal(response.statusCode, 200)
  const data = response.json()
  assert.equal(data.mode, 'live')
  assert.equal(data.activities.length, 1)
  assert.deepEqual(data.sources.github, { state: 'ready', count: 1 })
  assert.deepEqual(data.sources.slack, { state: 'error', count: 0, message: 'Slack conversations.history failed (missing_scope).' })
  await app.close()
})

test('activity denies anonymous or missing-board access even with configured sources', async () => {
  let providerCalls = 0
  const github = { async list() { providerCalls += 1; return [] } }
  const anonymous = createApp({ github })
  const denied = await anonymous.inject(`/api/activity?start=${start}&end=${end}`)
  assert.equal(denied.statusCode, 403)
  assert.equal(providerCalls, 0)
  await anonymous.close()

  const noBoard = createApp({ resolveActivityScope: async () => ({ boardId: '', github }) })
  assert.equal((await noBoard.inject(`/api/activity?start=${start}&end=${end}`)).statusCode, 403)
  assert.equal(providerCalls, 0)
  await noBoard.close()

  const scoped = createApp({ github, resolveActivityScope: async () => ({ boardId: 'board-1' }) })
  const limited = await scoped.inject(`/api/activity?start=${start}&end=${end}`)
  assert.equal(limited.statusCode, 200)
  assert.deepEqual(limited.json().activities, [])
  assert.deepEqual(limited.json().sources.github, { state: 'unconfigured', count: 0 })
  assert.equal(providerCalls, 0)
  await scoped.close()
})

test('task API requires a server identity and never trusts a requested user ID', async () => {
  const seen: string[] = []
  const taskStore = { async listAssignedTasks(userId: string, workspaceId: string) {
    seen.push(`${userId}:${workspaceId}`)
    return []
  } }
  const anonymous = createApp({ taskStore })
  assert.equal((await anonymous.inject('/api/tasks?userId=another-user')).statusCode, 401)
  assert.deepEqual(seen, [])
  await anonymous.close()

  const scoped = createApp({
    taskStore,
    resolveTaskIdentity: async () => ({ userId: 'trusted-user', workspaceId: 'trusted-workspace' }),
  })
  const response = await scoped.inject('/api/tasks?userId=another-user')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { source: 'supabase', tasks: [] })
  assert.deepEqual(seen, ['trusted-user:trusted-workspace'])
  await scoped.close()
})
