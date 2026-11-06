import {
  filterActivities,
  filterSupportedInsights,
  type Activity,
  type ActivityProvider,
  type CatchUpAnalyzer,
  type Insight,
} from './catchup.ts'
import { previousCalendarWeek, type TimeWindow } from './time.ts'

const hoursAgo = (now: Date, hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString()

function dayOfPreviousWeek(now: Date, locale: string, dayIndex: number, hour: number): string {
  const { start } = previousCalendarWeek(now, locale)
  const date = new Date(start)
  date.setDate(start.getDate() + dayIndex)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export function demoActivities(now: Date, locale: string): Activity[] {
  return [
    {
      id: 'slack-profile-decision',
      source: 'slack',
      kind: 'slack_thread',
      occurredAt: hoursAgo(now, 2),
      actor: 'Maya Chen',
      title: 'Profile response field discussion',
      body: 'Could we return display_name in the profile response? The frontend currently reads user_name. I would like to check compatibility before we decide whether to replace it.',
      location: '#backend-api · 5 replies',
    },
    {
      id: 'github-profile-pr',
      source: 'github',
      kind: 'github_pull_request',
      occurredAt: hoursAgo(now, 4),
      actor: 'Alex Rivera',
      title: 'PR #18 · Add display_name to profile response',
      body: 'Open pull request adding display_name to GET /users/:id. The existing user_name field is still present in the proposed implementation.',
      location: 'demo-api / pull requests',
    },
    {
      id: 'github-profile-review',
      source: 'github',
      kind: 'github_review_comment',
      occurredAt: hoursAgo(now, 3),
      actor: 'Sam Patel',
      title: 'Review comment on PR #18',
      body: 'Please confirm whether user_name should remain until the frontend migrates. The current change adds display_name but does not define the removal plan.',
      location: 'demo-api / PR #18 · review',
    },
    {
      id: 'github-profile-issue',
      source: 'github',
      kind: 'github_issue',
      occurredAt: hoursAgo(now, 7),
      actor: 'Jordan Lee',
      title: 'Issue #12 · Check profile UI field usage',
      body: 'Inventory frontend components that display user_name and verify how they should use display_name if the API adds it.',
      location: 'demo-api / issues',
    },
    {
      id: 'github-profile-commit',
      source: 'github',
      kind: 'github_commit',
      occurredAt: hoursAgo(now, 5),
      actor: 'Alex Rivera',
      title: 'Commit · Add display_name serializer field',
      body: 'Added display_name to the profile response serializer and updated its unit test. This commit belongs to the open PR #18.',
      location: 'demo-api / commits',
    },
    {
      id: 'slack-release-thread',
      source: 'slack',
      kind: 'slack_thread',
      occurredAt: hoursAgo(now, 9),
      actor: 'Priya Singh',
      title: 'Release timing still open',
      body: 'The team has not picked a release date for the profile API update. Please wait for the integration check before announcing a date.',
      location: '#team-planning · 4 replies',
    },
    {
      id: 'slack-pagination-decision',
      source: 'slack',
      kind: 'slack_thread',
      occurredAt: dayOfPreviousWeek(now, locale, 1, 11),
      actor: 'Maya Chen',
      title: 'Pagination proposal in API planning',
      body: 'We discussed moving the products endpoint to cursor pagination. The team has not recorded a final decision; the API contract still needs review.',
      location: '#backend-api · 8 replies',
    },
    {
      id: 'github-pagination-issue',
      source: 'github',
      kind: 'github_issue',
      occurredAt: dayOfPreviousWeek(now, locale, 2, 10),
      actor: 'Jordan Lee',
      title: 'Issue #9 · Explore cursor pagination',
      body: 'Compare page-number and cursor pagination for GET /products. No implementation decision is recorded in this issue.',
      location: 'demo-api / issues',
    },
    {
      id: 'github-pagination-pr',
      source: 'github',
      kind: 'github_pull_request',
      occurredAt: dayOfPreviousWeek(now, locale, 4, 15),
      actor: 'Alex Rivera',
      title: 'PR #14 · Prototype cursor pagination',
      body: 'Draft pull request exploring a cursor response for GET /products. It is not merged and does not establish the final API contract.',
      location: 'demo-api / pull requests',
    },
    {
      id: 'github-pagination-review',
      source: 'github',
      kind: 'github_review_comment',
      occurredAt: dayOfPreviousWeek(now, locale, 5, 14),
      actor: 'Sam Patel',
      title: 'Review comment on PR #14',
      body: 'What happens to clients that still send page_number? Please document the migration before this is merged.',
      location: 'demo-api / PR #14 · review',
    },
    {
      id: 'github-pagination-commit',
      source: 'github',
      kind: 'github_commit',
      occurredAt: dayOfPreviousWeek(now, locale, 3, 13),
      actor: 'Alex Rivera',
      title: 'Commit · Prototype cursor response',
      body: 'Added an experimental cursor parameter and response shape on the draft pagination branch.',
      location: 'demo-api / commits',
    },
    {
      id: 'slack-pagination-followup',
      source: 'slack',
      kind: 'slack_message',
      occurredAt: dayOfPreviousWeek(now, locale, 5, 16),
      actor: 'Priya Singh',
      title: 'API contract review requested',
      body: 'Let us review the pagination contract with frontend developers before choosing the final response format.',
      location: '#team-planning',
    },
  ]
}

const demoInsights: Insight[] = [
  {
    id: 'possible-profile-decision',
    category: 'possible_decision',
    title: 'Profile response naming is being discussed',
    body: 'The team is considering display_name, but the Slack thread does not establish a final decision.',
    evidenceIds: ['slack-profile-decision'],
  },
  {
    id: 'unresolved-profile-compatibility',
    category: 'unresolved',
    title: 'Compatibility with user_name needs an answer',
    body: 'A review comment asks whether the old field stays during migration. The PR remains open.',
    evidenceIds: ['github-profile-pr', 'github-profile-review'],
  },
  {
    id: 'unresolved-release-timing',
    category: 'unresolved',
    title: 'Profile API release timing is open',
    body: 'The team is waiting for an integration check before setting a release date.',
    evidenceIds: ['slack-release-thread'],
  },
  {
    id: 'profile-code-change',
    category: 'code_change',
    title: 'Profile response now has a proposed display_name field',
    body: 'PR #18 and its commit add the field. The PR is still open, so this is not a shipped API change.',
    evidenceIds: ['github-profile-pr', 'github-profile-commit'],
  },
  {
    id: 'profile-next-action',
    category: 'next_action',
    title: 'Check frontend profile field usage',
    body: 'Suggested next step: compare the profile UI with Issue #12 and inspect PR #18 before changing the frontend.',
    evidenceIds: ['github-profile-issue', 'github-profile-pr'],
  },
  {
    id: 'possible-pagination-decision',
    category: 'possible_decision',
    title: 'Cursor pagination is a proposal',
    body: 'A Slack discussion and draft PR explore cursor pagination. Neither source confirms a final API contract.',
    evidenceIds: ['slack-pagination-decision', 'github-pagination-pr'],
  },
  {
    id: 'pagination-unresolved',
    category: 'unresolved',
    title: 'Pagination migration behavior is unresolved',
    body: 'The PR review asks how existing page_number clients will migrate.',
    evidenceIds: ['github-pagination-review', 'github-pagination-pr'],
  },
  {
    id: 'pagination-code-change',
    category: 'code_change',
    title: 'A draft pagination implementation exists',
    body: 'The commit and PR prototype a cursor response. The change has not been merged.',
    evidenceIds: ['github-pagination-pr', 'github-pagination-commit'],
  },
  {
    id: 'pagination-next-action',
    category: 'next_action',
    title: 'Review the API contract with frontend',
    body: 'Suggested next step: inspect the draft PR and the team request before agreeing on a response format.',
    evidenceIds: ['slack-pagination-followup', 'github-pagination-pr'],
  },
]

export function createDemoProvider(now: Date, locale: string): ActivityProvider {
  return {
    async list(window: TimeWindow) {
      return filterActivities(demoActivities(now, locale), window)
    },
  }
}

export const demoAnalyzer: CatchUpAnalyzer = {
  async analyze(activities) {
    return filterSupportedInsights(demoInsights, activities)
  },
}
