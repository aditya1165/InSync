export interface ThreadEvent {
  channelId: string; threadTs: string; firstEventAt: string; lastEventAt: string
  revision: number; eventCount: number
}
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {}
const validTs = (value: unknown): value is string => typeof value === 'string' && /^\d{1,16}\.\d{1,6}$/.test(value)
// Metadata only: source text is fetched fresh from Slack when the user requests analysis.
export class SlackThreadCollector {
  private threads = new Map<string, ThreadEvent>()
  private seen = new Map<string, number>()
  private humanMessages = new Map<string, { threadTs: string; observedAt: number }>()
  private sequence = 0
  stats = { accepted: 0, duplicate: 0, ignored: 0 }
  constructor(privateChannel: string, privateTeam: string, limits = { threads: 100, events: 4096 }) {
    this.channel = privateChannel; this.team = privateTeam; this.limits = limits
  }
  readonly channel: string
  readonly team: string
  private limits: { threads: number; events: number }
  accept(payload: unknown, now = Date.now()): 'accepted' | 'duplicate' | 'ignored' {
    const body = record(payload), event = record(body.event)
    const ignore = () => { this.stats.ignored++; return 'ignored' as const }
    if (body.type !== 'event_callback' || body.team_id !== this.team || event.type !== 'message'
      || event.channel !== this.channel || typeof body.event_id !== 'string' || body.event_id.length > 200) return ignore()
    let message = event
    if (event.subtype === 'message_changed') message = record(event.message)
    else if (event.subtype === 'message_deleted') message = record(event.previous_message)
    else if (event.subtype && event.subtype !== 'thread_broadcast') return ignore()
    const knownDeletion = event.subtype === 'message_deleted' && validTs(event.deleted_ts) ? this.humanMessages.get(event.deleted_ts) : undefined
    if (message.bot_id || message.app_id || (!knownDeletion && (typeof message.user !== 'string' || !/^[UW][A-Z0-9]+$/.test(message.user)))) return ignore()
    const threadTs = message.thread_ts || knownDeletion?.threadTs || message.ts || event.deleted_ts
    const eventTs = event.event_ts || event.ts || message.edited?.ts || message.ts
    if (!validTs(threadTs) || !validTs(eventTs)) return ignore()
    const time = Number(eventTs) * 1000
    if (!Number.isFinite(time) || Math.abs(time - now) > 8 * 86400000) return ignore()
    for (const [id, seenAt] of this.seen) if (now - seenAt > 3600000) this.seen.delete(id)
    if (this.seen.has(body.event_id)) { this.stats.duplicate++; return 'duplicate' }
    this.seen.set(body.event_id, now)
    while (this.seen.size > this.limits.events) this.seen.delete(this.seen.keys().next().value!)
    for (const [id, entry] of this.threads) if (now - Date.parse(entry.lastEventAt) > 8 * 86400000) this.threads.delete(id)
    const messageTs = message.ts || event.deleted_ts
    if (validTs(messageTs)) {
      if (event.subtype === 'message_deleted') this.humanMessages.delete(messageTs)
      else this.humanMessages.set(messageTs, { threadTs, observedAt: now })
    }
    for (const [id, info] of this.humanMessages) if (now - info.observedAt > 8 * 86400000) this.humanMessages.delete(id)
    while (this.humanMessages.size > this.limits.events) this.humanMessages.delete(this.humanMessages.keys().next().value!)
    const previous = this.threads.get(threadTs)
    const stamp = new Date(time).toISOString()
    const entry: ThreadEvent = { channelId: this.channel, threadTs,
      firstEventAt: previous && previous.firstEventAt < stamp ? previous.firstEventAt : stamp,
      lastEventAt: previous && previous.lastEventAt > stamp ? previous.lastEventAt : stamp,
      revision: ++this.sequence, eventCount: (previous?.eventCount || 0) + 1 }
    this.threads.delete(threadTs); this.threads.set(threadTs, entry)
    while (this.threads.size > this.limits.threads) this.threads.delete(this.threads.keys().next().value!)
    this.stats.accepted++
    return 'accepted'
  }
  get(ts: string) { const found = this.threads.get(ts); return found ? { ...found } : undefined }
  list() { return [...this.threads.values()].sort((a,b) => b.lastEventAt.localeCompare(a.lastEventAt)).map((x) => ({ ...x })) }
}
