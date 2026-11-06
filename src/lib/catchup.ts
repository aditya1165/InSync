import { isInWindow, type TimeWindow } from './time.ts'

export type ActivitySource = 'slack' | 'github'
export type ActivityKind =
  | 'slack_message'
  | 'slack_thread'
  | 'github_issue'
  | 'github_pull_request'
  | 'github_commit'
  | 'github_review_comment'

export type InsightCategory = 'possible_decision' | 'unresolved' | 'code_change' | 'next_action'

export interface Activity {
  id: string
  source: ActivitySource
  kind: ActivityKind
  occurredAt: string
  actor: string
  title: string
  body: string
  location: string
  sourceUrl?: string
}

export interface Insight {
  id: string
  category: InsightCategory
  title: string
  body: string
  evidenceIds: string[]
}

export interface CatchUpResult {
  window: TimeWindow
  activities: Activity[]
  insights: Insight[]
  generatedAt: Date
  mode: 'demo'
}

export interface ActivityProvider {
  list(window: TimeWindow): Promise<Activity[]>
}

export interface CatchUpAnalyzer {
  analyze(activities: Activity[]): Promise<Insight[]>
}

export function filterActivities(activities: Activity[], window: TimeWindow): Activity[] {
  return activities
    .filter((activity) => isInWindow(activity.occurredAt, window))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export function filterSupportedInsights(insights: Insight[], activities: Activity[]): Insight[] {
  const activityIds = new Set(activities.map((activity) => activity.id))
  return insights.filter(
    (insight) =>
      insight.evidenceIds.length > 0 && insight.evidenceIds.every((id) => activityIds.has(id)),
  )
}

export async function createCatchUp(
  window: TimeWindow,
  provider: ActivityProvider,
  analyzer: CatchUpAnalyzer,
): Promise<CatchUpResult> {
  const activities = filterActivities(await provider.list(window), window)
  const insights = filterSupportedInsights(await analyzer.analyze(activities), activities)

  return {
    window,
    activities,
    insights,
    generatedAt: new Date(),
    mode: 'demo',
  }
}
