import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerRealDemo } from './real-demo/routes.ts'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DemoApi, ApiError } from './real-demo/api.ts'
import { demoConfig } from './real-demo/config.ts'
import { newManifest, saveManifest, type Manifest } from './real-demo/manifest.ts'
import { Simulator, plan, slackMessageUrl } from './real-demo/simulator.ts'
import { loadPagination, analyzePagination, samplePagination } from './real-demo/analysis.ts'
import { baselineFiles, backendPath, cursorBackend, frontendPath } from './real-demo/scenario.ts'
import { reviewLink } from '../src/lib/real-demo.ts'
import { createApp } from './app.ts'
import { SlackEventsRuntime } from './slack-events/runtime.ts'
import { SlackThreadCollector } from './slack-events/collector.ts'
import type { TaskAccess } from './real-demo/access.ts'
import { pinReplay, readReplay, saveReplay } from './real-demo/replay.ts'

const env = { GITHUB_OWNER: 'demo-owner', GITHUB_REPO: 'demo-repo', GITHUB_TOKEN: 'TEST_GH_SECRET', SLACK_BOT_TOKEN: 'TEST_SLACK_SECRET',
  SLACK_CHANNEL_ID: 'C123', GITHUB_DEMO_ALLOWLIST: 'demo-owner/demo-repo', SLACK_DEMO_ALLOWLIST: 'C123' }
const config = demoConfig(env)
const taskId = 'b7d521e0-9324-477a-9b62-075965d06002'
const task = { id: taskId, title: 'Build ProductList', component: 'ProductList', status: 'in_progress' as const, dependencies: [{ endpoint: 'GET /products', usedFields: ['totalPages'] }] }
const access: TaskAccess = { resolveTaskIdentity: async () => ({ userId: 'user', workspaceId: 'workspace' }), taskStore: {
  listAssignedTasks: async () => [task], listUserSources: async () => [{ id: 'gh', provider: 'github', externalId: config.repository, displayName: 'demo' }, { id: 'sl', provider: 'slack', externalId: config.channel, displayName: 'demo' }],
} }
// Stateful HTTP fake: exercises the actual adapters, Git object/ref creation,
// provenance reads, and recovery. All IDs below are test-only, never remote claims.
function remote() {
  let count = 0; let nextTs = Date.now() / 1000
  const sha = () => (++count).toString(16).padStart(40, '0')
  const initial = sha()
  const trees = new Map<string, Record<string, string>>([[initial, {}]])
  const commits = new Map<string, any>([[initial, { sha: initial, tree: { sha: initial }, message: 'initial' }]])
  const refs = new Map([['main', initial]])
  const messages: any[] = []; const prs: any[] = []; const writes: string[] = []
  let failAfterPost = false; let failAfterRef = false; let failAfterPr = false; let calls = 0
  function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status }) }
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++
    const url = new URL(String(input)); const method = init?.method || 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (method !== 'GET') writes.push(`${method} ${url.pathname}`)
    if (url.hostname === 'slack.com') {
      const operation = url.pathname.split('/').at(-1)
      const params: any = method === 'GET' ? Object.fromEntries(url.searchParams) : body
      if (operation === 'auth.test') return json({ ok: true, bot_id: 'B1', team_id: 'T1' })
      if (operation === 'conversations.info') return json({ ok: true, channel: { id: 'C123', is_member: true } })
      if (operation === 'conversations.history') return json({ ok: true, messages: messages.filter((m) => !m.thread_ts) })
      if (operation === 'conversations.replies') return json({ ok: true, messages: messages.filter((m) => m.ts === params.ts || m.thread_ts === params.ts) })
      if (operation === 'chat.getPermalink') {
        const message = messages.find((m) => m.ts === params.message_ts)
        const parent = message?.thread_ts || (messages.some((m) => m.thread_ts === params.message_ts) ? params.message_ts : '')
        return json({ ok: true, permalink: `https://test.slack.com/archives/C123/p${params.message_ts.replace('.', '')}${parent ? `?thread_ts=${parent}&cid=C123` : ''}` })
      }
      if (operation === 'chat.postMessage') {
        const ts = (nextTs += 1).toFixed(6)
        messages.push({ ts, text: params.text.replace(/https?:\/\/[^\s]+/g, (url: string) => `<${url}>`), thread_ts: params.thread_ts, bot_id: 'B1' })
        if (failAfterPost) { failAfterPost = false; throw new Error('timeout after Slack accepted') }
        return json({ ok: true, ts })
      }
      if (operation === 'chat.delete') { const i = messages.findIndex((m) => m.ts === params.ts); if (i >= 0) messages.splice(i, 1); return json({ ok: true }) }
    }
    const path = decodeURIComponent(url.pathname.replace('/repos/demo-owner/demo-repo', ''))
    if (path === '') return json({ id: 100, full_name: 'demo-owner/demo-repo', default_branch: 'main', permissions: { push: true } })
    if (path.startsWith('/git/ref/heads/')) {
      const key = path.replace('/git/ref/heads/', '')
      return refs.has(key) ? json({ object: { sha: refs.get(key) } }) : json({}, 404)
    }
    if (path === '/git/trees') {
      const id = sha(); const files = { ...trees.get(body.base_tree) }
      body.tree.forEach((entry: any) => { files[entry.path] = entry.content }); trees.set(id, files)
      return json({ sha: id })
    }
    if (path === '/git/commits') {
      const id = sha(); const commit = { sha: id, tree: { sha: body.tree }, message: body.message, parents: body.parents }
      commits.set(id, commit); return json(commit)
    }
    if (path.startsWith('/git/commits/')) return json(commits.get(path.split('/').at(-1)!))
    if (path === '/git/refs') {
      refs.set(body.ref.replace('refs/heads/', ''), body.sha)
      if (failAfterRef) { failAfterRef = false; throw new Error('timeout after GitHub accepted ref') }
      return json({ ref: body.ref, object: { sha: body.sha } })
    }
    if (path.startsWith('/git/refs/heads/') && method === 'DELETE') { refs.delete(path.replace('/git/refs/heads/', '')); return new Response(null, { status: 204 }) }
    if (path.startsWith('/contents/')) {
      const commit = commits.get(url.searchParams.get('ref')!)
      const content = trees.get(commit.tree.sha)![path.replace('/contents/', '')]
      return json({ encoding: 'base64', content: Buffer.from(content).toString('base64') })
    }
    if (path === '/pulls' && method === 'GET') return json(prs)
    if (path === '/pulls' && method === 'POST') {
      const timestamp = new Date().toISOString()
      const pr = { id: 500, number: 37, title: body.title, body: body.body, html_url: 'https://github.com/demo-owner/demo-repo/pull/37', created_at: timestamp, updated_at: timestamp,
        state: 'open', head: { ref: body.head, sha: refs.get(body.head), repo: { full_name: config.repository } }, base: { ref: body.base, sha: refs.get(body.base) } }
      prs.push(pr); if (failAfterPr) { failAfterPr = false; throw new Error('timeout after PR created') }; return json(pr)
    }
    if (path === '/pulls/37/files') return json([{ filename: backendPath, patch: '-  return { items, totalPages: 2 };\n+  return { items, nextCursor: null };' }])
    if (path === '/pulls/37' && method === 'GET') return json(prs[0])
    if (path === '/pulls/37' && method === 'PATCH') { Object.assign(prs[0], body); return json(prs[0]) }
    throw new Error(`Unhandled test request ${method} ${path}`)
  }) as typeof fetch
  return { fetcher, refs, initial, messages, prs, writes, calls: () => calls,
    failPost: () => { failAfterPost = true }, failRef: () => { failAfterRef = true }, failPr: () => { failAfterPr = true } }
}
function setup() {
  const r = remote(); let disk: Manifest = newManifest(config)
  const api = new DemoApi(config, r.fetcher, async () => {})
  const make = () => new Simulator(api, structuredClone(disk), async (m) => { disk = structuredClone(m) })
  return { r, api, make, disk: () => disk }
}

test('allowlists fail closed; dry-run plan contains no credentials or writes', () => {
  assert.throws(() => demoConfig({ ...env, GITHUB_DEMO_ALLOWLIST: '' }), /allowlist/i)
  assert.throws(() => demoConfig({ ...env, GITHUB_REPOSITORY: 'wrong/repo' }), /disagree/)
  const output = JSON.stringify(plan(config))
  assert.ok(!output.includes(env.GITHUB_TOKEN)); assert.ok(!output.includes(env.SLACK_BOT_TOKEN))
  assert.match(output, /defaultBranch.*unchanged/)
})
test('actual adapters seed real-shaped IDs, verify readback, and repeated seeding makes no extra writes', async () => {
  const { r, make, disk } = setup()
  await make().seed()
  assert.equal(disk().pr?.number, 37)
  assert.equal(r.messages.length, 5); assert.equal(r.prs.length, 1)
  assert.equal(r.refs.get('main'), r.initial)
  assert.ok(r.messages.every((m) => m.text.includes('staged demo') && m.bot_id === 'B1'))
  assert.ok(r.messages.at(-1).text.includes(disk().pr!.url))
  const writes = r.writes.length
  await make().seed()
  assert.equal(r.writes.length, writes)
  assert.ok(disk().verifiedAt)
})
test('ambiguous Slack post timeout recovers by marker without duplicate proposal', async () => {
  const { r, make } = setup(); r.failPost()
  await assert.rejects(make().seed(), /may have succeeded/)
  assert.equal(r.messages.length, 1)
  await make().seed()
  assert.equal(r.messages.length, 5); assert.equal(r.prs.length, 1)
})
test('ambiguous GitHub ref timeout recovers journaled branch without overwrite', async () => {
  const { r, make } = setup(); r.failRef()
  await assert.rejects(make().seed(), /may have succeeded/)
  const original = r.refs.get('insync-demo/pagination-v1-base')
  await make().seed()
  assert.equal(r.refs.get('insync-demo/pagination-v1-base'), original)
})
test('unowned branch collisions are refused', async () => {
  const { r, make } = setup(); r.refs.set('insync-demo/pagination-v1-base', r.initial)
  await assert.rejects(make().seed(), /not owned/)
  assert.equal(r.refs.get('insync-demo/pagination-v1-base'), r.initial)
})
test('live analysis fetches remote code, removed totalPages, ProductList and ordered Slack provenance', async () => {
  const { make, api, disk } = setup(); await make().seed()
  const result = await loadPagination(api, disk(), new Date(Date.now() - 7 * 86400000), new Date(Date.now() + 60000))
  assert.equal(result.mode, 'live'); assert.equal(result.generatedBy, 'evidence_rules')
  assert.equal(result.impact, 'breaking'); assert.equal(result.task.component, 'ProductList')
  assert.equal(result.decision.status, 'confirmed'); assert.equal(result.link.status, 'possible')
  assert.equal(result.pr.number, 37); assert.ok(result.inWindow)
  assert.equal(result.code.length, 4); assert.equal(result.messages.length, 5)
  assert.ok(result.link.evidenceIds.every((id) => [result.pr.id, ...result.messages.map((m) => m.id)].includes(id)))
  assert.ok(result.code.some((s) => s.body.includes('response.totalPages') && s.url?.includes(frontendPath)))
  const outside = await loadPagination(api, disk(), new Date('2000-01-01'), new Date('2000-01-02'))
  assert.equal(outside.inWindow, false)
})
test('incomplete patch, absent consumer, additive response, unconfirmed/superseded decision stay uncertain', () => {
  const start = new Date(Date.now() - 7 * 86400000), end = new Date()
  const sample = samplePagination(start, end)
  const input = { mode: 'sample' as const, pr: sample.pr, before: baselineFiles[backendPath]!, after: cursorBackend,
    frontend: baselineFiles[frontendPath]!, patch: '- totalPages: 2', complete: true, code: sample.code, messages: sample.messages }
  assert.equal(analyzePagination({ ...input, complete: false }, start, end).impact, 'uncertain')
  assert.equal(analyzePagination({ ...input, frontend: 'other component' }, start, end).impact, 'uncertain')
  assert.equal(analyzePagination({ ...input, after: cursorBackend + '\n// totalPages: kept' }, start, end).impact, 'uncertain')
  assert.equal(analyzePagination({ ...input, messages: sample.messages.slice(0, 2) }, start, end).decision.status, 'proposed')
  const newer = { id: 'sample:superseded', title: 'Maya', body: 'DEC-14 superseded: retain offset pagination', timestamp: end.toISOString() }
  assert.equal(analyzePagination({ ...input, messages: [...sample.messages, newer] }, start, end).decision.status, 'superseded')
})
test('reject/correct controls preserve source decision status and require inspectable replacement IDs', () => {
  const data = samplePagination(new Date(Date.now() - 7 * 86400000), new Date())
  assert.equal(reviewLink({ state: 'rejected' }, data.messages).state, 'rejected')
  assert.equal(reviewLink({ state: 'corrected', correctedMessageId: data.messages[0]!.id }, data.messages).state, 'corrected')
  assert.throws(() => reviewLink({ state: 'corrected', correctedMessageId: 'invented' }, data.messages), /inspectable/)
  assert.equal(data.decision.status, 'confirmed'); assert.equal(data.link.status, 'possible')
})
test('cleanup refuses modified branches and only removes recorded bot messages and demo refs', async () => {
  const { r, make, disk } = setup(); await make().seed()
  const head = disk().branches.head!
  r.refs.set(head.name, r.initial)
  await assert.rejects(make().cleanup(), /new commits/)
  assert.equal(r.messages.length, 5); assert.equal(r.prs[0].state, 'open')
  r.refs.set(head.name, head.sha)
  r.messages.push({ ts: '1', text: 'Real teammate reply', thread_ts: disk().messages.proposal!.ts, user: 'REAL' })
  await make().cleanup('slack')
  assert.equal(r.messages.length, 2); assert.ok(r.messages.some((m) => m.user === 'REAL')); assert.ok(disk().messages.proposal)
  assert.ok(r.refs.has(head.name))
  await make().cleanup('github')
  assert.equal(r.refs.size, 1); assert.equal(r.refs.get('main'), r.initial)
  assert.equal(r.prs[0].state, 'closed')
})
test('rate limits retry reads; permission failures are safe and secrets never enter errors', async () => {
  let calls = 0; const delays: number[] = []
  const api = new DemoApi(config, (async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '1' } }) : new Response('{"ok":true}')) as typeof fetch,
    async (ms) => { delays.push(ms) })
  await api.slack('auth.test'); assert.equal(calls, 2); assert.equal(delays.length, 1)
  const bad = new DemoApi(config, (async () => new Response('{"token":"TEST_GH_SECRET"}', { status: 403 })) as typeof fetch)
  await assert.rejects(bad.gh(''), (e: unknown) => e instanceof ApiError && !e.message.includes(env.GITHUB_TOKEN))
})
test('contract test passes on seeded baseline and fails on cursor head without touching repository code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'insync-contract-'))
  for (const [path, content] of Object.entries(baselineFiles)) { await mkdir(join(dir, path, '..'), { recursive: true }); await writeFile(join(dir, path), content) }
  const childEnv = { ...process.env }; delete childEnv.NODE_TEST_CONTEXT
  const run = () => spawnSync(process.execPath, ['--test', 'insync-pagination-demo/contract.test.mjs'], { cwd: dir, encoding: 'utf8', env: childEnv })
  assert.equal(run().status, 0)
  await writeFile(join(dir, backendPath), cursorBackend)
  const broken = run(); assert.equal(broken.status, 1); assert.match(broken.stdout, /ProductList requires totalPages/)
})
test('HTTP sample path is explicit, validates windows, and keeps both pagination workflows usable offline', async () => {
  const app = createApp({})
  try {
    assert.equal((await app.inject('/api/real-demo/catch-up')).statusCode, 400)
    const end = new Date().toISOString(); const start = new Date(Date.now() - 7 * 86400000).toISOString()
    const response = await app.inject(`/api/real-demo/catch-up?${new URLSearchParams({ mode: 'sample', start, end })}`)
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().task.component, 'ProductList'); assert.equal(response.json().mode, 'sample')
  } finally { await app.close() }
})

test('ambiguous PR creation recovers the actual assigned PR number without duplication', async () => {
  const { r, make } = setup(); r.failPr()
  await assert.rejects(make().seed(), /may have succeeded/)
  assert.equal(r.prs.length, 1)
  await make().seed(); assert.equal(r.prs.length, 1)
})
test('edited Slack evidence and merged PRs cannot be silently verified or cleaned', async () => {
  const { r, make } = setup(); await make().seed()
  r.messages[2].text = 'Edited confirmation'
  await assert.rejects(make().verify(), /Slack evidence/)
  await assert.rejects(make().cleanup('slack'), /edited or unowned/)
  assert.equal(r.messages.length, 5)
  r.prs[0].merged_at = new Date().toISOString()
  await assert.rejects(make().cleanup('github'), /merged/)
  assert.equal(r.refs.size, 3)
})
test('CLI defaults to dry-run and refuses an unconfirmed apply before making API calls', () => {
  const childEnv = { ...process.env, ...env, GITHUB_REPOSITORY: config.repository, DEMO_RUN_ID: config.runId, DEMO_MANIFEST_PATH: '.demo/cli-test-only.json' }; delete childEnv.NODE_TEST_CONTEXT
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'server/real-demo/cli.ts', ...args], { encoding: 'utf8', env: childEnv })
  const preview = run('seed')
  assert.equal(preview.status, 0, preview.stderr); assert.equal(JSON.parse(preview.stdout).dryRun, true)
  assert.ok(!preview.stdout.includes(env.GITHUB_TOKEN))
  const apply = run('seed', '--apply'); assert.equal(apply.status, 1); assert.match(apply.stderr, /Explicit target confirmation required/)
  const cleanup = run('cleanup', '--apply'); assert.equal(cleanup.status, 1); assert.match(cleanup.stderr, /Explicit target confirmation required/)
})

test('validation catches missing token Contents permission before any remote write', async () => {
  const r = remote()
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (new URL(String(input)).pathname.includes('/git/ref/')) return new Response('{}', { status: 403 })
    return r.fetcher(input, init)
  }) as typeof fetch
  const api = new DemoApi(config, fetcher)
  await assert.rejects(api.validate(), /Contents: read\/write/)
  assert.equal(r.writes.length, 0)
})

test('validation explains an empty repository before any remote write', async () => {
  const r = remote()
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (new URL(String(input)).pathname.includes('/git/ref/')) return new Response('{}', { status: 409 })
    return r.fetcher(input, init)
  }) as typeof fetch
  await assert.rejects(new DemoApi(config, fetcher).validate(), /repository is empty.*README/)
  assert.equal(r.writes.length, 0)
})

test('Slack thread context may change without changing the linked source message', () => {
  const message = 'https://test.slack.com/archives/C123/p123456'
  assert.equal(slackMessageUrl(message), slackMessageUrl(message + '?thread_ts=123.456&cid=C123'))
  assert.notEqual(slackMessageUrl(message), slackMessageUrl('https://test.slack.com/archives/C123/p654321'))
})

test('live pagination route cannot bypass production or public-bind source access controls', async () => {
  for (const restricted of [{ NODE_ENV: 'production' }, { HOST: '0.0.0.0' }]) {
    const app = Fastify(); let fetched = false
    registerRealDemo(app, { ...env, ...restricted }, (async () => { fetched = true; throw new Error('Unexpected remote read') }) as typeof fetch)
    try {
      const query = new URLSearchParams({ mode: 'live', start: '2026-11-01T00:00:00Z', end: '2026-11-09T00:00:00Z' })
      const response = await app.inject(`/api/real-demo/catch-up?${query}`)
      assert.equal(response.statusCode, 403); assert.equal(fetched, false)
      assert.match(response.json().error, /authenticated source grants/)
      query.set('mode', 'sample')
      assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 200)
    } finally { await app.close() }
  }
})

test('human Slack threads use fresh API content and dynamic decision IDs independently of the seeded bot discussion', async () => {
  const { r, api, make, disk } = setup(); await make().seed()
  const base = Date.now() - 120000
  const humanTs = (n: number) => ((base + n * 1000) / 1000).toFixed(6)
  const humanRoot = humanTs(0)
  r.messages.push(
    { ts: humanRoot, user: 'U1', text: 'I propose cursor-based pagination for GET /products. Decision DEC-15.' },
    { ts: humanTs(1), thread_ts: humanRoot, user: 'U2', text: '+1 to cursor-based pagination.' },
    { ts: humanTs(2), thread_ts: humanRoot, user: 'U1', text: `Decision DEC-15 confirmed: remove totalPages and return nextCursor. Implementation: <${disk().pr!.url}>` },
  )
  r.messages[2].text = 'Seeded bot content was edited; it must not block an independent human thread.'
  const data = await loadPagination(api, disk(), new Date(base - 60000), new Date(), humanRoot)
  assert.equal(data.decision.id, 'DEC-15'); assert.equal(data.decision.status, 'confirmed')
  assert.equal(data.messages.length, 3); assert.ok(data.messages.every((m) => m.actorId?.startsWith('U')))
  assert.equal(data.link.status, 'possible'); assert.equal(data.impact, 'breaking'); assert.ok(data.inWindow)
  assert.ok(data.link.evidenceIds.includes(`slack:C123:${humanTs(2)}`))
  assert.equal(reviewLink({ state: 'rejected' }, data.messages).state, 'rejected')
  assert.equal(data.decision.status, 'confirmed')
  // Removing/negating the explicit confirmation cannot leave a confirmed source decision.
  r.messages.at(-1).text = 'Decision DEC-15 confirmed: do not remove totalPages or nextCursor.'
  assert.equal((await loadPagination(api, disk(), new Date(base - 60000), new Date(), humanRoot)).decision.status, 'proposed')
})
test('bot confirmations cannot be reused as human decision evidence', async () => {
  const { r, api, make, disk } = setup(); await make().seed()
  const root = disk().messages.proposal!.ts
  r.messages.push({ ts: String(Number(root) + 10), thread_ts: root, user: 'U1', text: 'I have a question about the current change.' })
  await assert.rejects(loadPagination(api, disk(), new Date(Date.now() - 86400000), new Date(Date.now() + 60000), root), /human parent/)
})
test('human thread API accepts only indexed approved-channel threads and returns their source revision', async () => {
  const { r, make, disk } = setup(); await make().seed()
  const stamp = ((Date.now() - 10000) / 1000).toFixed(6)
  r.messages.push({ ts: stamp, user: 'U1', text: 'I propose cursor-based pagination for GET /products.' })
  await mkdir('.demo', { recursive: true })
  const dir = await mkdtemp('.demo/event-test-')
  const manifestPath = `${dir}/manifest.json`
  await saveManifest({ ...config, manifestPath }, disk())
  const runtime = new SlackEventsRuntime()
  runtime.collector = new SlackThreadCollector('C123', 'T1')
  runtime.collector.accept({ type: 'event_callback', event_id: 'EvHuman', team_id: 'T1', event: { type: 'message', channel: 'C123', user: 'U1', ts: stamp, text: 'PRIVATE SOURCE' } })
  const app = Fastify(); registerRealDemo(app, { ...env, DEMO_MANIFEST_PATH: manifestPath }, r.fetcher, runtime, access)
  try {
    const query = new URLSearchParams({ taskId, mode: 'live', start: new Date(Date.now() - 86400000).toISOString(), end: new Date(Date.now() + 60000).toISOString(), threadTs: '123.000001' })
    assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 404)
    query.set('threadTs', stamp)
    const response = await app.inject(`/api/real-demo/catch-up?${query}`)
    assert.equal(response.statusCode, 200, response.body)
    const data = response.json()
    assert.equal(data.slackSource, 'human_events'); assert.equal(data.slackThreadTs, stamp)
    assert.equal(data.slackThreadRevision, runtime.collector.get(stamp)!.revision)
    assert.equal(data.decision.status, 'proposed'); assert.equal(data.link.status, 'possible')
    assert.ok(!data.messages[0].body.includes('PRIVATE SOURCE')) // readback, not event text, is authoritative
  } finally { await app.close(); await unlink(manifestPath); await rmdir(dir) }
})
test('a new human message can fall inside the absence window while the linked PR predates it', () => {
  const end = new Date(), start = new Date(end.getTime() - 60000)
  const sample = samplePagination(new Date(end.getTime() - 7 * 86400000), end)
  const input = { mode: 'live' as const, pr: { ...sample.pr, timestamp: new Date(start.getTime() - 86400000).toISOString() },
    before: baselineFiles[backendPath]!, after: cursorBackend, frontend: baselineFiles[frontendPath]!, patch: '- totalPages: 2', complete: true,
    humanDiscussion: true, code: sample.code, messages: [{ id: 'human:now', title: 'Human', body: 'I propose cursor-based pagination.', timestamp: new Date(end.getTime() - 1000).toISOString() }] }
  assert.equal(analyzePagination(input, start, end).inWindow, true)
})

test('task-aware catch-up fails closed before any provider read for missing identity, ownership or source grants', async () => {
  const query = new URLSearchParams({ mode: 'live', taskId, start: '2026-11-01T00:00:00Z', end: '2026-11-09T00:00:00Z' })
  const cases: [TaskAccess, number][] = [
    [{}, 401],
    [{ ...access, taskStore: undefined }, 503],
    [{ ...access, taskStore: { ...access.taskStore!, listAssignedTasks: async () => [] } }, 404],
    [{ ...access, taskStore: { ...access.taskStore!, listUserSources: async () => [] } }, 403],
    [{ ...access, taskStore: { ...access.taskStore!, listUserSources: async () => [{ id: 'other', provider: 'github', externalId: 'other/repo', displayName: 'other' }] } }, 403],
  ]
  for (const [scope, expected] of cases) {
    const app = Fastify(); let reads = 0
    registerRealDemo(app, env, (async () => { reads++; throw new Error('Unexpected provider read') }) as typeof fetch, undefined, scope)
    try { assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, expected); assert.equal(reads, 0) }
    finally { await app.close() }
  }
  const app = Fastify(); registerRealDemo(app, env, fetch, undefined, access)
  try {
    query.delete('taskId'); assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 400)
    query.set('taskId', 'not-a-uuid'); assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 400)
  } finally { await app.close() }
})
test('database task component, endpoint and consumed fields all gate the ProductList impact claim', async () => {
  const { make, api, disk } = setup(); await make().seed()
  const start = new Date(Date.now() - 86400000), end = new Date(Date.now() + 60000)
  const valid = await loadPagination(api, disk(), start, end, undefined, task)
  assert.equal(valid.impact, 'breaking'); assert.equal(valid.task.id, taskId)
  assert.ok(valid.impactEvidenceIds?.includes(`task:${taskId}`))
  assert.ok(valid.code.some((r) => r.id === `task:${taskId}`))
  for (const unrelated of [{ ...task, component: 'SearchCatalog' }, { ...task, dependencies: [] }, { ...task, dependencies: [{ endpoint: 'GET /search/products', usedFields: ['totalPages'] }] }, { ...task, dependencies: [{ endpoint: 'GET /products', usedFields: ['items'] }] }]) {
    const data = await loadPagination(api, disk(), start, end, undefined, unrelated)
    assert.equal(data.impact, 'uncertain'); assert.match(data.explanation, /Relevance uncertain/)
    assert.equal(data.task.component, unrelated.component)
  }
})
test('pinned human replay survives a fresh runtime, refetches sources read-only, and handles deleted/edited evidence and API failures', async () => {
  const { r, api, make, disk } = setup(); await make().seed()
  const root = ((Date.now() - 20000) / 1000).toFixed(6)
  const ts = (n: number) => (Number(root) + n).toFixed(6)
  r.messages.push({ ts: root, user: 'U1', text: 'I propose cursor-based pagination for GET /products.' },
    { ts: ts(1), thread_ts: root, user: 'U2', text: '+1 to cursor-based pagination.' },
    { ts: ts(2), thread_ts: root, user: 'U1', text: `Decision DEC-15 confirmed: remove totalPages and return nextCursor. ${disk().pr!.url}` })
  await mkdir('.demo', { recursive: true })
  const dir = await mkdtemp('.demo/replay-test-')
  const c = { ...config, manifestPath: `${dir}/manifest.json` }
  const writes = r.writes.length
  try {
    await saveManifest(c, disk())
    const profile = await pinReplay(api, disk())
    await saveReplay(c, profile)
    assert.equal((await readReplay(c, disk()))?.threadTs, root)
    assert.ok(!JSON.stringify(profile).includes('I propose'))
    const app = Fastify()
    // No collector events, no Socket Mode connection, as after a restart.
    registerRealDemo(app, { ...env, DEMO_MANIFEST_PATH: c.manifestPath }, r.fetcher, new SlackEventsRuntime(), access)
    const query = new URLSearchParams({ taskId, replay: 'true', mode: 'live', ...profile.window })
    try {
      const settings = await app.inject(`/api/real-demo/replay?taskId=${taskId}`)
      assert.equal(settings.statusCode, 200); assert.equal(settings.json().threadTs, root)
      const response = await app.inject(`/api/real-demo/catch-up?${query}`)
      assert.equal(response.statusCode, 200, response.body)
      const data = response.json()
      assert.equal(data.slackSource, 'human_replay'); assert.equal(data.decision.id, 'DEC-15')
      assert.equal(data.decision.status, 'confirmed'); assert.equal(data.task.id, taskId)
      assert.equal(data.slackThreadRevision, undefined); assert.equal(data.impact, 'breaking')
      query.set('start', '2000-01-01T00:00:00Z'); query.set('end', '2000-01-02T00:00:00Z')
      assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).json().inWindow, false)
      query.set('start', profile.window.start); query.set('end', profile.window.end)
      r.messages.at(-1).text = 'Decision DEC-15 is not confirmed.'
      const edited = (await app.inject(`/api/real-demo/catch-up?${query}`)).json()
      assert.equal(edited.decision.status, 'proposed')
      r.messages.splice(r.messages.findIndex((m) => m.ts === root), 1)
      assert.equal((await app.inject(`/api/real-demo/catch-up?${query}`)).statusCode, 502)
      assert.equal(r.writes.length, writes)
    } finally { await app.close() }
    const failing = Fastify()
    registerRealDemo(failing, { ...env, DEMO_MANIFEST_PATH: c.manifestPath }, (async () => new Response('{}', { status: 403 })) as typeof fetch, undefined, access)
    try { const response = await failing.inject(`/api/real-demo/catch-up?${query}`); assert.equal(response.statusCode, 502); assert.ok(!response.body.includes(env.GITHUB_TOKEN)) }
    finally { await failing.close() }
    // Tampered or cross-target profile is rejected before readback.
    await writeFile(`${dir}/manifest.replay.json`, JSON.stringify({ ...profile, channel: 'COTHER' }))
    await assert.rejects(readReplay(c, disk()), /Replay target/)
  } finally {
    await unlink(c.manifestPath).catch(() => {})
    await unlink(`${dir}/manifest.replay.json`).catch(() => {})
    await rmdir(dir)
  }
})
