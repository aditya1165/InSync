import 'dotenv/config'
import { SlackEventsRuntime } from './slack-events/runtime.ts'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createGitHubProvider } from './providers/github.ts'
import { createSlackProvider } from './providers/slack.ts'
import { createDatabasePool } from './db/pool.ts'
import { listAssignedTasks } from './db/tasks.ts'
import { listUserSources } from './db/catchup.ts'

const config = loadConfig()
const db = process.env.DATABASE_URL ? createDatabasePool(process.env.DATABASE_URL) : null
const demoUserId = process.env.INSYNC_DEMO_USER_ID?.trim()
const demoWorkspaceId = process.env.INSYNC_DEMO_WORKSPACE_ID?.trim()
const localDemoIdentity = config.host === '127.0.0.1' && process.env.NODE_ENV !== 'production' && demoUserId && demoWorkspaceId
  ? { userId: demoUserId, workspaceId: demoWorkspaceId }
  : null

const slackEvents = new SlackEventsRuntime()
const app = createApp({
  slackEvents,
  taskStore: db ? { listAssignedTasks: (userId, workspaceId) => listAssignedTasks(db, userId, workspaceId), listUserSources: (userId, workspaceId) => listUserSources(db, userId, workspaceId) } : undefined,
  // One-user local demo only. Production must resolve identity from verified Auth.
  resolveTaskIdentity: localDemoIdentity ? async () => localDemoIdentity : undefined,
  github: config.github.repository
    ? createGitHubProvider({
        repository: config.github.repository,
        token: config.github.token,
        apiVersion: config.github.apiVersion,
      })
    : undefined,
  slack: config.slack.token && config.slack.channels.length > 0
    ? createSlackProvider({ token: config.slack.token, channels: config.slack.channels })
    : undefined,
})
app.addHook('onClose', async () => { await slackEvents.stop() })
if (db) app.addHook('onClose', async () => { await db.end() })

try {
  await app.listen({ host: config.host, port: config.port })
  void slackEvents.start()
  console.log(`InSync API listening on http://${config.host}:${config.port}`)
} catch (error) {
  app.log.error(error)
  process.exitCode = 1
}
