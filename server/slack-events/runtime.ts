import { SocketModeClient, LogLevel, type Logger } from '@slack/socket-mode'
import { DemoApi } from '../real-demo/api.ts'
import { demoConfig } from '../real-demo/config.ts'
import { SlackThreadCollector } from './collector.ts'
export type ListenerState = 'disabled' | 'not_configured' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
export interface SocketTransport {
  on(name: string, listener: (...args: any[]) => void): unknown
  start(): Promise<unknown>
  disconnect(): Promise<void>
}
export type TransportFactory = (token: string) => SocketTransport
// Never log SDK payloads, connection URLs, or credential-bearing error objects.
const quietLogger: Logger = { debug() {}, info() {}, warn() {}, error() {}, setLevel() {}, setName() {}, getLevel: () => LogLevel.ERROR }
export const localDemoAllowed = (env: NodeJS.ProcessEnv) => env.NODE_ENV !== 'production' && (env.HOST || '127.0.0.1') === '127.0.0.1'
export class SlackEventsRuntime {
  collector?: SlackThreadCollector
  private state: ListenerState = 'disabled'
  private detail = 'Set SLACK_EVENTS_ENABLED=true and configure Socket Mode to receive human messages.'
  private client?: SocketTransport
  private starting?: Promise<void>
  private stopped = false
  private connectedAt?: string
  private env: NodeJS.ProcessEnv
  private fetcher: typeof fetch
  private factory: TransportFactory
  constructor(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch,
    factory: TransportFactory = (token) => new SocketModeClient({ appToken: token, logger: quietLogger, autoReconnectEnabled: true,
      clientOptions: { retryConfig: { retries: 2 }, timeout: 15000 } })) {
    this.env = env; this.fetcher = fetcher; this.factory = factory
    if (env.SLACK_EVENTS_ENABLED === 'true') {
      this.state = 'not_configured'; this.detail = 'Add SLACK_APP_TOKEN (xapp, connections:write) and enable Socket Mode/bot message events in Slack.'
    }
  }
  snapshot() {
    return { state: this.state, detail: this.detail, connectedAt: this.connectedAt,
      channelId: this.collector?.channel || null, threads: this.collector?.list() || [],
      stats: this.collector ? { ...this.collector.stats } : { accepted: 0, duplicate: 0, ignored: 0 },
      retention: 'Metadata only, latest 100 threads, up to 8 days; cleared on server restart. No pre-start backfill.' }
  }
  start(): Promise<void> {
    if (this.starting) return this.starting
    if (this.client || this.env.SLACK_EVENTS_ENABLED !== 'true') return Promise.resolve()
    this.starting = this.connect().finally(() => { this.starting = undefined })
    return this.starting
  }
  private async connect() {
    if (!localDemoAllowed(this.env)) { this.state = 'disabled'; this.detail = 'Slack event collection is restricted to the local loopback demo.'; return }
    const token = this.env.SLACK_APP_TOKEN?.trim()
    if (!token?.startsWith('xapp-')) return
    try {
      const c = demoConfig(this.env)
      if (!c.slackToken) throw new Error('missing_bot_token')
      this.state = 'connecting'; this.detail = 'Validating bot identity and channel access.'
      const api = new DemoApi(c, this.fetcher)
      const auth = await api.slack('auth.test')
      if (!auth.bot_id || typeof auth.team_id !== 'string') throw new Error('not_bot')
      const { channel } = await api.slack('conversations.info', { channel: c.channel })
      if (channel.id !== c.channel || !channel.is_member || channel.is_archived) throw new Error('channel_access')
      if (this.stopped) return
      this.collector = new SlackThreadCollector(c.channel, auth.team_id)
      this.client = this.factory(token)
      for (const state of ['connecting', 'connected', 'reconnecting', 'disconnected'] as const) {
        this.client.on(state, () => {
          this.state = state
          this.detail = state === 'connected' ? 'Listening for human message events in the approved channel. Analysis refreshes on Catch me up.' : `Slack Socket Mode is ${state}. Events may be missed while offline.`
          if (state === 'connected') this.connectedAt = new Date().toISOString()
        })
      }
      this.client.on('error', () => { this.state = 'error'; this.detail = 'Slack connection error. Check token, Socket Mode, and subscriptions; no source payloads are logged.' })
      this.client.on('slack_event', (packet: { body?: unknown; type?: string; ack?: () => Promise<unknown> }) => {
        // Synchronous bounded metadata indexing, followed immediately by Slack's envelope ack.
        // No API calls or analysis occur before acknowledging the event.
        if (!this.stopped && packet.type === 'events_api') this.collector?.accept(packet.body)
        void packet.ack?.().catch(() => { this.detail = 'Event acknowledgement failed; Slack may retry. Event IDs are deduplicated.' })
      })
      await this.client.start()
    } catch {
      await this.client?.disconnect().catch(() => {})
      this.client = undefined
      this.state = 'error'; this.detail = 'Could not connect. Check matching xapp/xoxb app tokens, channel membership, Socket Mode and message subscriptions.'
    }
  }
  async stop() { this.stopped = true; await this.client?.disconnect().catch(() => {}); this.client = undefined }
}
