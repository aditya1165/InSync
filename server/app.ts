import Fastify from 'fastify'
import { filterActivities, type Activity, type ActivityProvider, type ActivityResponse, type ActivitySource, type SourceStatus } from '../src/lib/catchup.ts'
import type { TimeWindow } from '../src/lib/time.ts'
import { registerAnalysisDemo } from './analysis/demo-routes.ts'

export interface AppProviders {
  github?: ActivityProvider
  slack?: ActivityProvider
}

function publicError(error: unknown): string {
  return error instanceof Error ? error.message : 'Source request failed.'
}

export function createApp(providers: AppProviders) {
  const app = Fastify({ logger: false })
  registerAnalysisDemo(app)

  app.get('/api/health', async () => ({
    status: 'ok',
    sources: {
      github: providers.github ? 'configured' : 'unconfigured',
      slack: providers.slack ? 'configured' : 'unconfigured',
    },
  }))

  app.get<{ Querystring: { start: string; end: string } }>(
    '/api/activity',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['start', 'end'],
          additionalProperties: false,
          properties: {
            start: { type: 'string', minLength: 1 },
            end: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply): Promise<ActivityResponse | void> => {
      const start = new Date(request.query.start)
      const end = new Date(request.query.end)
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
        reply.code(400).send({ error: 'start and end must be valid dates, with start before end.' })
        return
      }

      const window: TimeWindow = { start, end }
      const sourceNames: ActivitySource[] = ['github', 'slack']
      const results = await Promise.allSettled(
        sourceNames.map((name) => providers[name]?.list(window) ?? Promise.resolve([])),
      )
      const sources = {} as Record<ActivitySource, SourceStatus>
      const activities: Activity[] = []

      sourceNames.forEach((name, index) => {
        const result = results[index]!
        if (!providers[name]) {
          sources[name] = { state: 'unconfigured', count: 0 }
        } else if (result.status === 'rejected') {
          sources[name] = { state: 'error', count: 0, message: publicError(result.reason) }
        } else {
          const selected = filterActivities(result.value, window)
          sources[name] = { state: 'ready', count: selected.length }
          activities.push(...selected)
        }
      })

      return {
        mode: 'live',
        window: { start: start.toISOString(), end: end.toISOString() },
        activities: filterActivities(activities, window),
        sources,
      }
    },
  )

  return app
}
