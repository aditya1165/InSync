import 'dotenv/config'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createGitHubProvider } from './providers/github.ts'
import { createSlackProvider } from './providers/slack.ts'

const config = loadConfig()
const app = createApp({
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

try {
  await app.listen({ host: config.host, port: config.port })
  console.log(`InSync API listening on http://${config.host}:${config.port}`)
} catch (error) {
  app.log.error(error)
  process.exitCode = 1
}
