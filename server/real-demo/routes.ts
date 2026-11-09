import type { FastifyInstance } from 'fastify'
import { DemoApi } from './api.ts'
import { demoConfig, requireCredentials } from './config.ts'
import { readManifest } from './manifest.ts'
import { loadPagination, samplePagination } from './analysis.ts'
import { readReplay, replaySettings } from './replay.ts'
import { AccessError, authorizeTask, type TaskAccess } from './access.ts'
import { localDemoAllowed, type SlackEventsRuntime } from '../slack-events/runtime.ts'
export function registerRealDemo(app: FastifyInstance, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch, events?: SlackEventsRuntime, access: TaskAccess = {}) {
  app.get('/api/slack-events/status', async (_request, reply) => {
    if (!localDemoAllowed(env)) return reply.code(403).send({ error: 'Event metadata is restricted to the local demo.' })
    return events?.snapshot() || { state: 'disabled', detail: 'Socket Mode is not running. See docs/SLACK_EVENTS_DEMO.md.', channelId: null,
      threads: [], stats: { accepted: 0, ignored: 0, duplicate: 0 }, retention: 'No event metadata is currently collected.' }
  })
  app.get<{ Querystring: { taskId?: string } }>('/api/real-demo/replay', async (request, reply) => {
    if (!localDemoAllowed(env)) return reply.code(403).send({ error: 'Replay is restricted to the local loopback demo.' })
    try {
      const c = demoConfig(env)
      await authorizeTask(access, request, request.query.taskId, c)
      const profile = await readReplay(c, await readManifest(c))
      if (!profile) return reply.code(409).send({ error: 'No saved scenario. Run npm run demo:pin first.' })
      return replaySettings(profile)
    } catch (e) {
      return reply.code(e instanceof AccessError ? e.status : 503).send({ error: e instanceof AccessError ? e.message : 'Saved scenario unavailable. Check the local replay profile and configuration.' })
    }
  })
  app.get<{ Querystring: { mode?: string; start?: string; end?: string; threadTs?: string; taskId?: string; replay?: string } }>('/api/real-demo/catch-up', async (request, reply) => {
    const { mode, start: from, end: to } = request.query
    const start = new Date(from || ''); const end = new Date(to || '')
    if (!['live', 'sample'].includes(mode || '') || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return reply.code(400).send({ error: 'Choose live or sample and a valid absence start/end.' })
    }
    // Offline has an explicit sample assignment; it never implies Supabase ownership.
    if (mode === 'sample') return samplePagination(start, end)
    if (!localDemoAllowed(env)) {
      return reply.code(403).send({ error: 'Live pagination evidence is available only in the local loopback demo. Production access requires authenticated source grants.' })
    }
    try {
      const c = demoConfig(env)
      const task = await authorizeTask(access, request, request.query.taskId, c)
      requireCredentials(c)
      const manifest = await readManifest(c)
      if (!manifest) return reply.code(409).send({ error: 'No simulator manifest. Use the existing approved run or select labeled offline data.' })
      const replay = request.query.replay === 'true' ? await readReplay(c, manifest) : undefined
      if (request.query.replay === 'true' && !replay) return reply.code(409).send({ error: 'No pinned scenario. Run npm run demo:pin first.' })
      const threadTs = replay?.threadTs || request.query.threadTs
      const thread = threadTs ? events?.collector?.get(threadTs) : undefined
      if (!replay && threadTs && (!thread || thread.channelId !== c.channel)) return reply.code(404).send({ error: 'This human thread has not been collected in the approved channel. Use the saved scenario after a restart.' })
      const result = await loadPagination(new DemoApi(c, fetcher), manifest, start, end, threadTs, task)
      return { ...result, slackSource: replay ? 'human_replay' : thread ? 'human_events' : 'seeded',
        ...(threadTs ? { slackThreadTs: threadTs, ...(thread ? { slackThreadRevision: thread.revision } : {}) } : {}) }
    } catch (e) {
      return reply.code(e instanceof AccessError ? e.status : 502).send({ error: e instanceof AccessError ? e.message : 'Live evidence unavailable or changed. Check demo:verify; the labeled offline sample is available.' })
    }
  })
}
