import { filterActivities, type Activity, type ActivityProvider } from '../../src/lib/catchup.ts'
import type { TimeWindow } from '../../src/lib/time.ts'
import type { SlackChannel } from '../config.ts'

interface SlackConfig {
  token: string
  channels: SlackChannel[]
}

interface SlackMessage {
  ts: string
  text?: string
  user?: string
  bot_id?: string
  thread_ts?: string
  reply_count?: number
  latest_reply?: string
  subtype?: string
}

interface SlackListResponse {
  ok: boolean
  error?: string
  messages?: SlackMessage[]
  has_more?: boolean
  response_metadata?: { next_cursor?: string }
}

function inWindow(ts: string, window: TimeWindow): boolean {
  const milliseconds = Number(ts) * 1000
  return Number.isFinite(milliseconds) && milliseconds >= window.start.getTime() && milliseconds < window.end.getTime()
}

function messageTitle(message: SlackMessage): string {
  const first = (message.text || '').split('\n')[0]?.trim() || 'Slack activity'
  return first.length > 90 ? `${first.slice(0, 87)}…` : first
}

export function createSlackProvider(config: SlackConfig, fetcher: typeof fetch = fetch): ActivityProvider {
  async function call<T extends { ok: boolean; error?: string }>(method: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://slack.com/api/${method}`)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Slack ${method} request failed (HTTP ${response.status}).`)
    const data = await response.json() as T
    if (!data.ok) throw new Error(`Slack ${method} failed (${data.error || 'unknown_error'}).`)
    return data
  }

  async function messages(method: 'conversations.history' | 'conversations.replies', params: Record<string, string>): Promise<SlackMessage[]> {
    const all: SlackMessage[] = []
    let cursor = ''
    for (let page = 1; page <= 50; page += 1) {
      const data = await call<SlackListResponse>(method, { ...params, limit: '100', ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(data.messages)) throw new Error(`Slack ${method} returned an invalid message list.`)
      all.push(...data.messages)
      cursor = data.response_metadata?.next_cursor || ''
      if (!data.has_more && !cursor) return all
      if (!cursor) throw new Error(`Slack ${method} did not provide a pagination cursor.`)
    }
    throw new Error(`Slack ${method} has too many pages for one catch-up; narrow the channel scope.`)
  }

  async function toActivity(message: SlackMessage, channel: SlackChannel, isReply: boolean): Promise<Activity> {
    const data = await call<{ ok: boolean; error?: string; permalink?: string }>('chat.getPermalink', {
      channel: channel.id,
      message_ts: message.ts,
    })
    if (!data.permalink) throw new Error('Slack chat.getPermalink returned no link.')
    return {
      id: `slack:${channel.id}:${message.ts}`,
      source: 'slack',
      kind: isReply || (message.reply_count || 0) > 0 ? 'slack_thread' : 'slack_message',
      occurredAt: new Date(Number(message.ts) * 1000).toISOString(),
      actor: message.user || message.bot_id || 'Unknown Slack user',
      title: messageTitle(message),
      body: message.text || 'No message text provided.',
      location: `#${channel.name}${isReply ? ' · thread' : ''}`,
      sourceUrl: data.permalink,
    }
  }

  return {
    async list(window: TimeWindow): Promise<Activity[]> {
      const selected: { message: SlackMessage; channel: SlackChannel; isReply: boolean }[] = []
      for (const channel of config.channels) {
        // Scan parent messages even before the range: an old thread can receive a new reply.
        const parents = await messages('conversations.history', {
          channel: channel.id,
          latest: String(window.end.getTime() / 1000),
          inclusive: 'false',
        })
        for (const parent of parents) {
          if (inWindow(parent.ts, window)) selected.push({ message: parent, channel, isReply: false })
          if (!parent.reply_count || (parent.latest_reply && Number(parent.latest_reply) * 1000 < window.start.getTime())) continue
          const replies = await messages('conversations.replies', {
            channel: channel.id,
            ts: parent.ts,
            oldest: String(window.start.getTime() / 1000),
            latest: String(window.end.getTime() / 1000),
            inclusive: 'true',
          })
          for (const reply of replies) {
            if (reply.ts !== parent.ts && inWindow(reply.ts, window)) {
              selected.push({ message: reply, channel, isReply: true })
            }
          }
        }
      }

      const unique = [...new Map(selected.map((item) => [`${item.channel.id}:${item.message.ts}`, item])).values()]
      const activities: Activity[] = []
      // Slack may rate limit this method, so resolve permalinks sequentially.
      for (const item of unique) activities.push(await toActivity(item.message, item.channel, item.isReply))
      return filterActivities(activities, window)
    },
  }
}
