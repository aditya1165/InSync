import type { FastifyInstance } from 'fastify'
import { DemoApi } from './api.ts'
import { demoConfig, requireCredentials } from './config.ts'
import { readManifest } from './manifest.ts'
import { loadPagination, samplePagination } from './analysis.ts'
import { localDemoAllowed, type SlackEventsRuntime } from '../slack-events/runtime.ts'
export function registerRealDemo(app: FastifyInstance, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch, events?: SlackEventsRuntime) {
  app.get('/api/slack-events/status', async (_request, reply) => {
    if (!localDemoAllowed(env)) return reply.code(403).send({ error: 'Event metadata is restricted to the local demo.' })
    return events?.snapshot() || { state: 'disabled', detail: 'Socket Mode is not running. See docs/SLACK_EVENTS_DEMO.md.', channelId: null,
      threads: [], stats: { accepted: 0, ignored: 0, duplicate: 0 }, retention: 'No event metadata is currently collected.' }
  })
  app.get<{ Querystring: { mode?: string; start?: string; end?: string; threadTs?: string } }>('/api/real-demo/catch-up', async (request, reply) => {
    const { mode, start: from, end: to } = request.query
    const start = new Date(from || ''); const end = new Date(to || '')
    if (!['live', 'sample'].includes(mode || '') || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return reply.code(400).send({ error: 'Choose live or sample and a valid absence start/end.' })
    }
    if (mode === 'sample') return samplePagination(start, end)
    if (env.NODE_ENV === 'production' || (env.HOST || '127.0.0.1') !== '127.0.0.1') {
      return reply.code(403).send({ error: 'Live pagination evidence is available only in the local loopback demo. Production access requires authenticated source grants.' })
    }
    try {
      const c = demoConfig(env); requireCredentials(c)
      const manifest = await readManifest(c)
      if (!manifest) return reply.code(409).send({ error: 'No simulator manifest. Run an approved seed and verify first, or select labeled sample data.' })
      const threadTs = request.query.threadTs
      const thread = threadTs ? events?.collector?.get(threadTs) : undefined
      if (threadTs && (!thread || thread.channelId !== c.channel)) return reply.code(404).send({ error: 'This human thread has not been collected in the approved channel. Start the listener before posting.' })
      const result = await loadPagination(new DemoApi(c, fetcher), manifest, start, end, threadTs)
      return { ...result, slackSource: thread ? 'human_events' : 'seeded', ...(thread ? { slackThreadTs: thread.threadTs, slackThreadRevision: thread.revision } : {}) }
    } catch (e) {
      return reply.code(502).send({ error: e instanceof Error ? e.message : 'Live evidence unavailable. Select sample data explicitly for the offline demo.' })
    }
  })
}
