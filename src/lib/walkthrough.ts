import { reviewLink, type LinkReview, type PaginationCatchUp } from './real-demo.ts'
export interface WalkthroughResult {
  result: PaginationCatchUp | null
  review: LinkReview
  why: boolean
}
export type WalkthroughAction = { type: 'reset' } | { type: 'loaded'; result: PaginationCatchUp } | { type: 'review'; review: LinkReview } | { type: 'why' }
export const emptyWalkthrough: WalkthroughResult = { result: null, review: { state: 'pending' }, why: false }
/** Owned by App, so switching views cannot create a second result or review. */
export function walkthroughReducer(state: WalkthroughResult, action: WalkthroughAction): WalkthroughResult {
  switch (action.type) {
    case 'reset': return emptyWalkthrough
    case 'loaded': return { ...emptyWalkthrough, result: action.result }
    case 'review': return state.result ? { ...state, review: reviewLink(action.review, state.result.messages) } : state
    case 'why': return { ...state, why: !state.why }
  }
}
export function scenarioRecords(result: PaginationCatchUp, filter: 'all' | 'github' | 'slack' = 'all') {
  const records = [{ ...result.pr, provider: 'github' as const }, ...result.messages.map((m) => ({ ...m, provider: 'slack' as const }))]
  const start = Date.parse(result.window?.start || ''), end = Date.parse(result.window?.end || '')
  return records.filter((r) => {
    const times = 'number' in r ? [result.pr.createdAt || r.timestamp, result.pr.updatedAt || r.timestamp] : [r.timestamp]
    return (filter === 'all' || r.provider === filter) && times.some((t) => Date.parse(t) >= start && Date.parse(t) < end)
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
