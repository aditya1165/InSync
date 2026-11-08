import Fastify from 'fastify'
import type { FastifyRequest } from 'fastify'
import { filterActivities, type Activity, type ActivityProvider, type ActivityResponse, type ActivitySource, type SourceStatus } from '../src/lib/catchup.ts'
import type { TimeWindow } from '../src/lib/time.ts'
import { registerAnalysisDemo } from './analysis/demo-routes.ts'
import { registerDemoRoutes } from './routes/demo.ts'
import type { AssignedTask } from './db/tasks.ts'

export interface AppProviders {
  github?: ActivityProvider
  slack?: ActivityProvider
  /** Resolve only after authenticating the user and checking their ticket-board source grants. */
  resolveActivityScope?: (request: FastifyRequest) => Promise<ActivityScope | null>
  taskStore?: { listAssignedTasks(userId: string, workspaceId: string): Promise<AssignedTask[]> }
  resolveTaskIdentity?: (request: FastifyRequest) => Promise<{ userId: string; workspaceId: string } | null>
}

export interface ActivityScope {
  boardId: string
  github?: ActivityProvider
  slack?: ActivityProvider
}

function publicError(error: unknown): string {
  return error instanceof Error ? error.message : 'Source request failed.'
}

export function createApp(providers: AppProviders) {
  const app = Fastify({ logger: false })
  registerAnalysisDemo(app)
  registerDemoRoutes(app)

  app.get('/api/health', async () => ({
    status: 'ok',
    sources: {
      github: providers.github ? 'configured' : 'unconfigured',
      slack: providers.slack ? 'configured' : 'unconfigured',
    },
  }))

  app.get('/api/tasks', async (request, reply) => {
    const identity = await providers.resolveTaskIdentity?.(request)
    if (!identity) return reply.code(401).send({ error: 'Sign-in is required to load assigned tasks.' })
    if (!providers.taskStore) return reply.code(503).send({ error: 'The task database is not configured.' })
    try {
      const tasks = await providers.taskStore.listAssignedTasks(identity.userId, identity.workspaceId)
      return { source: 'supabase', tasks }
    } catch {
      return reply.code(503).send({ error: 'Assigned tasks could not be loaded.' })
    }
  })

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
      // Never expose globally configured sources to an anonymous or unscoped request.
      const scope = await providers.resolveActivityScope?.(request)
      if (!scope?.boardId?.trim()) {
        reply.code(403).send({ error: 'Team activity requires sign-in and access to a ticket board.' })
        return
      }
      const start = new Date(request.query.start)
      const end = new Date(request.query.end)
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
        reply.code(400).send({ error: 'start and end must be valid dates, with start before end.' })
        return
      }

      const window: TimeWindow = { start, end }
      const sourceNames: ActivitySource[] = ['github', 'slack']
      const results = await Promise.allSettled(
        sourceNames.map((name) => scope[name]?.list(window) ?? Promise.resolve([])),
      )
      const sources = {} as Record<ActivitySource, SourceStatus>
      const activities: Activity[] = []

      sourceNames.forEach((name, index) => {
        const result = results[index]!
        if (!scope[name]) {
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
