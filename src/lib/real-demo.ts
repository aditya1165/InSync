export type LinkReview = { state: 'pending' | 'confirmed' | 'rejected' | 'deferred' | 'corrected'; correctedMessageId?: string }
export interface DemoSource { id: string; title: string; body: string; url?: string; timestamp: string; actorId?: string }
export interface PaginationCatchUp {
  mode: 'live' | 'sample'
  generatedBy: 'evidence_rules'
  slackSource?: 'seeded' | 'human_events'
  slackThreadTs?: string
  slackThreadRevision?: number
  task: { owner: string; component: string; endpoint: string }
  inWindow: boolean
  impact: 'breaking' | 'uncertain'
  explanation: string
  actions: string[]
  uncertainty: string[]
  pr: DemoSource & { number: number; lifecycle: string }
  code: DemoSource[]
  messages: DemoSource[]
  decision: { id: string; status: 'proposed' | 'confirmed' | 'superseded' | 'unverified'; evidenceIds: string[] }
  link: { status: 'possible'; rationale: string; evidenceIds: string[] }
}
// Review applies to the relationship, never the source decision or PR lifecycle.
export function reviewLink(review: LinkReview, messages: DemoSource[]): LinkReview {
  if (review.state === 'corrected' && !messages.some((m) => m.id === review.correctedMessageId)) {
    throw new Error('Choose an inspectable Slack message from this thread.')
  }
  return review
}

export interface SlackEventStatus {
  state: 'disabled' | 'not_configured' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
  detail: string
  channelId: string | null
  connectedAt?: string
  retention: string
  stats: { accepted: number; ignored: number; duplicate: number }
  threads: { channelId: string; threadTs: string; firstEventAt: string; lastEventAt: string; revision: number; eventCount: number }[]
}
