import { filterActivities, filterSupportedInsights, type Activity, type ActivityProvider, type CatchUpAnalyzer, type Insight } from './catchup.ts'
import { previousCalendarWeek } from './time.ts'

export function demoActivities(now: Date, locale: string): Activity[] {
  const start = previousCalendarWeek(now, locale).start
  const at = (days: number) => new Date(start.getTime() + days * 86400000 + 12 * 3600000).toISOString()
  return [
    { id: 'sample:pagination:proposal', source: 'slack', kind: 'slack_thread', occurredAt: at(1), actor: 'Sample Maya', title: 'Staged proposal: cursor pagination', body: 'Offset pagination is too slow for large lists. Propose cursor-based pagination for GET /products.', location: 'Sample #pagination-demo' },
    { id: 'sample:pagination:agreement', source: 'slack', kind: 'slack_thread', occurredAt: at(1.01), actor: 'Sample Sam', title: 'Staged agreement', body: '+1 to cursor-based pagination.', location: 'Sample #pagination-demo' },
    { id: 'sample:pagination:decision', source: 'slack', kind: 'slack_thread', occurredAt: at(1.02), actor: 'Sample Maya', title: 'Staged DEC-14 confirmation', body: 'DEC-14 confirmed: remove totalPages and return nextCursor. ProductList needs migration.', location: 'Sample #pagination-demo' },
    { id: 'sample:pagination:pr', source: 'github', kind: 'github_pull_request', occurredAt: at(3), actor: 'Sample Maya', title: 'Sample PR: Replace offset pagination with cursor-based pagination', body: 'Open sample PR removes totalPages from GET /products. ProductList still reads response.totalPages. No actual remote PR is represented.', location: 'Sample repository' },
  ]
}
const insights: Insight[] = [
  { id: 'sample:pagination:link', category: 'possible_decision', title: 'DEC-14 may explain the pagination PR', body: 'Scripted sample relationship; inspect both sources and review the link.', evidenceIds: ['sample:pagination:decision', 'sample:pagination:pr'] },
  { id: 'sample:pagination:impact', category: 'code_change', title: 'ProductList expects a removed field', body: 'Sample PR removes totalPages. Inspect the pagination impact panel for contract evidence.', evidenceIds: ['sample:pagination:pr'] },
]
export function createDemoProvider(now: Date, locale: string): ActivityProvider {
  return { async list(window) { return filterActivities(demoActivities(now, locale), window) } }
}
export const demoAnalyzer: CatchUpAnalyzer = { async analyze(activities) { return filterSupportedInsights(insights, activities) } }
